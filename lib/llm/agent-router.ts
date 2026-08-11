import { generateText, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// ============================================================================
// ROTEADOR MULTIAGENTE — Estratégia HÍBRIDA STRICT (Free-First com Fallback
// Pago em Emergências). Usado pelo llm-proxy e pelo script de verificação RAG.
//
// DIRETRIZ DE CUSTO ZERO:
//   - 100% das requisições devem ser consumidas por provedores GRATUITOS
//     (Groq e Google Gemini).
//   - O saldo do OpenRouter (DeepSeek V3 / Claude) SÓ é acionado quando TODOS
//     os modelos gratuitos falharem (rate limits, HTTP 429, HTTP 413 ou
//     indisponibilidade). Tiers pagos disparam WARNING no log do servidor.
//
// TIERS DE EXECUÇÃO:
//   1. Gratuito (Prioridade Máxima)   → groq('llama-3.3-70b-versatile')
//   2. Gratuito (Modelo Rápido)       → groq('llama-3.1-8b-instant')
//   3. Gratuito (Contingência)        → google('gemini-2.0-flash')
//   4. PAGO (Emergência / OpenRouter) → openrouter('deepseek/deepseek-chat')            [DeepSeek V3]
//   5. PAGO (Último Recurso MCP)      → openrouter('anthropic/claude-3-5-haiku-20241022') [Claude 3.5 Haiku]
//
// Se um agente falhar (ex.: 429/413/timeout), o próximo tier é tentado
// imediatamente (cascata com try/catch).
// ============================================================================

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
  // ── 4ª Tentativa — PAGO (Emergência / OpenRouter) ──────────────────────────
  {
    id: 'openrouter-deepseek',
    label: 'OpenRouter (DeepSeek V3)',
    envKeys: ['OPENROUTER_API_KEY'],
    modelId: 'deepseek/deepseek-chat',
    createModel: (apiKey) => (modelId) => createOpenRouter({ apiKey })(modelId),
    paid: true,
  },
  // ── 5ª Tentativa — PAGO (Último Recurso MCP) ───────────────────────────────
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
 * Tiers pagos (4º/5º) só são acionados após TODOS os gratuitos falharem,
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
