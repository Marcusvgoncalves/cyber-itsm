import { generateText, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';
import { cohere } from '@ai-sdk/cohere';

// ============================================================================
// ROTEADOR MULTIAGENTE — Estratégia HÍBRIDA STRICT (Free-First com Fallback
// Pago em Emergências). Usado pelo llm-proxy e pelo script de verificação RAG.
//
// DIRETRIZ DE CUSTO ZERO:
//   - 100% das requisições devem ser consumidas por provedores GRATUITOS
//     (Groq, Google Gemini, SambaNova e Cohere).
//   - O saldo do OpenRouter (DeepSeek V3 / Claude) SÓ é acionado quando TODOS
//     os modelos gratuitos falharem (rate limits, HTTP 429, HTTP 413 ou
//     indisponibilidade). Tiers pagos disparam WARNING no log do servidor.
//
// TIERS DE EXECUÇÃO:
//   1. Gratuito (Prioridade Máxima)   → groq('llama-3.3-70b-versatile')
//   2. Gratuito (Modelo Rápido)       → groq('llama-3.1-8b-instant')
//   3. Gratuito (Contingência)        → google('gemini-2.0-flash')
//   4. Gratuito (Alta Capacidade)     → sambanova('Meta-Llama-3.3-70B-Instruct')         [SambaNova Free]
//   5. Gratuito (Alta Capacidade)     → cohere('command-r-08-2024')                      [Cohere]
//   6. PAGO (Emergência / OpenRouter) → openrouter('deepseek/deepseek-chat')            [DeepSeek V3]
//   7. PAGO (Último Recurso MCP)      → openrouter('anthropic/claude-3-5-haiku-20241022') [Claude 3.5 Haiku]
//
// Se um agente falhar (ex.: 429/413/timeout), o próximo tier é tentado
// imediatamente (cascata com try/catch).
// ============================================================================

// ============================================================================
// NOVOS PROVEDORES GRATUITOS DE ALTA CAPACIDADE
// (alívio do gargalo de Rate Limit diário do Groq — ADITIVO, nada é removido)
// ============================================================================

/** Instância customizada para o Free Tier da SambaNova (API compatível com OpenAI). */
const sambanova = createOpenAI({
  baseURL: 'https://api.sambanova.ai/v1',
  apiKey: process.env.SAMBANOVA_API_KEY,
});

// Cohere: o export `cohere` do `@ai-sdk/cohere` JÁ é a instância do provedor
// (lê process.env.COHERE_API_KEY automaticamente) — nenhuma instância extra.

function resolveApiKey(names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() !== '' && !value.includes('your_')) return value;
  }
  return null;
}

interface AgentConfig {
  id: string;
  label: string;
  envKeys: string[];
  modelId: string;
  createModel: (apiKey: string) => (modelId: string) => LanguageModel;
  temperature?: number;
  /** Tiers pagos (OpenRouter) — disparam warning de rastreabilidade de custo. */
  paid?: boolean;
}

const AGENTS: AgentConfig[] = [
  // ── 1ª Tentativa — Gratuito (Prioridade Máxima) ────────────────────────────
  {
    id: 'groq-70b',
    label: 'Groq (Llama 3.3 70B Versatile)',
    envKeys: ['GROQ_API_KEY'],
    modelId: 'llama-3.3-70b-versatile',
    createModel: (apiKey) => (modelId) => createGroq({ apiKey })(modelId),
  },
  // ── 2ª Tentativa — Gratuito (Modelo Rápido) ────────────────────────────────
  {
    id: 'groq-8b',
    label: 'Groq (Llama 3.1 8B Instant)',
    envKeys: ['GROQ_API_KEY'],
    modelId: 'llama-3.1-8b-instant',
    createModel: (apiKey) => (modelId) => createGroq({ apiKey })(modelId),
  },
  // ── 3ª Tentativa — Gratuito (Contingência) ─────────────────────────────────
  {
    id: 'google',
    label: 'Google (Gemini 2.0 Flash)',
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    modelId: 'gemini-2.0-flash',
    createModel: (apiKey) => (modelId) => createGoogleGenerativeAI({ apiKey })(modelId),
    temperature: 0.7,
  },
  // ── 4ª Tentativa — Gratuito (Alta Capacidade / SambaNova Free) ─────────────
  {
    id: 'sambanova-llama-70b',
    label: 'SambaNova (Meta Llama 3.3 70B Instruct)',
    envKeys: ['SAMBANOVA_API_KEY'],
    modelId: 'Meta-Llama-3.3-70B-Instruct',
    createModel: () => sambanova,
  },
  // ── 5ª Tentativa — Gratuito (Alta Capacidade / Cohere) ─────────────────────
  {
    id: 'cohere-command-r',
    label: 'Cohere (Command R 08-2024)',
    envKeys: ['COHERE_API_KEY'],
    modelId: 'command-r-08-2024',
    createModel: () => cohere,
  },
  // ── 6ª Tentativa — PAGO (Emergência / OpenRouter) ──────────────────────────
  {
    id: 'openrouter-deepseek',
    label: 'OpenRouter (DeepSeek V3)',
    envKeys: ['OPENROUTER_API_KEY'],
    modelId: 'deepseek/deepseek-chat',
    createModel: (apiKey) => (modelId) => createOpenRouter({ apiKey })(modelId),
    paid: true,
  },
  // ── 7ª Tentativa — PAGO (Último Recurso MCP) ───────────────────────────────
  {
    id: 'openrouter-claude',
    label: 'OpenRouter (Claude 3.5 Haiku)',
    envKeys: ['OPENROUTER_API_KEY'],
    modelId: 'anthropic/claude-3-5-haiku-20241022',
    createModel: (apiKey) => (modelId) => createOpenRouter({ apiKey })(modelId),
    paid: true,
  },
];

export type AgentRouterResult = {
  provider: string;
  model: string;
  response: string;
};

/**
 * Roda o prompt através dos tiers em cascata e devolve o primeiro sucesso.
 * Tiers pagos (6º/7º) só são acionados após TODOS os gratuitos falharem,
 * emitindo um warning de rastreabilidade de custo no log do servidor.
 * @throws {Error} se TODOS os provedores configurados falharem.
 */
export async function routeToModel(
  prompt: string,
  system?: string,
  agentList: AgentConfig[] = AGENTS
): Promise<AgentRouterResult> {
  const failures: Array<{ id: string; message: string }> = [];

  for (const agent of agentList) {
    const apiKey = resolveApiKey(agent.envKeys);
    if (!apiKey) continue;

    if (agent.paid) {
      console.warn(
        '[Agent Router] [WARN] Provedores gratuitos indisponíveis. Acionando Fallback Pago via OpenRouter...'
      );
    }

    try {
      const { text } = await generateText({
        model: agent.createModel(apiKey)(agent.modelId),
        ...(system ? { system } : {}),
        prompt,
        ...(agent.temperature ? { temperature: agent.temperature } : {}),
      });
      return { provider: agent.id, model: agent.modelId, response: text };
    } catch (error: any) {
      failures.push({ id: agent.id, message: error?.message || String(error) });
      continue;
    }
  }

  throw new Error('AGENTES_INDISPONIVEIS: ' + JSON.stringify(failures));
}
