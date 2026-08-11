import { generateText, type LanguageModel } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenAI } from '@ai-sdk/openai';

// ============================================================================
// ROTEADOR MULTIAGENTE — Esteira ENXUTA (SambaNova Free + OpenRouter Pago).
// Usado pelo llm-proxy e pelo script de verificação RAG.
//
// DIRETRIZ DE CUSTO:
//   - Prioridade 100% gratuita via SambaNova (alta capacidade e liberdade de
//     cota). O saldo do OpenRouter (DeepSeek V3 / Claude) SÓ é acionado quando
//     TODOS os modelos gratuitos falharem (429/413/timeout). Tiers pagos
//     disparam WARNING de rastreabilidade de custo no log do servidor.
//
// TIERS DE EXECUÇÃO:
//   1. Gratuito (Primário)   → sambanova('Meta-Llama-3.3-70B-Instruct')
//   2. Gratuito (Secundário) → sambanova('Meta-Llama-3.1-8B-Instruct')
//   3. PAGO (Fallback 1)     → openrouter('deepseek/deepseek-chat')            [DeepSeek V3]
//   4. PAGO (Fallback 2)     → openrouter('anthropic/claude-3-5-haiku-20241022') [Claude 3.5 Haiku]
//
// Se um agente falhar, o próximo tier é tentado imediatamente (cascata com
// try/catch).
// ============================================================================

/** Instância da SambaNova (Free Tier, API compatível com OpenAI). */
const sambanova = createOpenAI({
  baseURL: 'https://api.sambanova.ai/v1',
  apiKey: process.env.SAMBANOVA_API_KEY,
});

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
  // ── 1º Tier — Gratuito (Primário / Alta Capacidade) ────────────────────────
  {
    id: 'sambanova-70b',
    label: 'SambaNova (Meta Llama 3.3 70B Instruct)',
    envKeys: ['SAMBANOVA_API_KEY'],
    modelId: 'Meta-Llama-3.3-70B-Instruct',
    createModel: () => sambanova,
  },
  // ── 2º Tier — Gratuito (Secundário / Modelo Rápido) ────────────────────────
  {
    id: 'sambanova-8b',
    label: 'SambaNova (Meta Llama 3.1 8B Instruct)',
    envKeys: ['SAMBANOVA_API_KEY'],
    modelId: 'Meta-Llama-3.1-8B-Instruct',
    createModel: () => sambanova,
  },
  // ── 3º Tier — PAGO (Fallback 1 / OpenRouter) ───────────────────────────────
  {
    id: 'openrouter-deepseek',
    label: 'OpenRouter (DeepSeek V3)',
    envKeys: ['OPENROUTER_API_KEY'],
    modelId: 'deepseek/deepseek-chat',
    createModel: (apiKey) => (modelId) => createOpenRouter({ apiKey })(modelId),
    paid: true,
  },
  // ── 4º Tier — PAGO (Fallback 2 / OpenRouter) ───────────────────────────────
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
 * Tiers pagos (3º/4º) só são acionados após TODOS os gratuitos falharem,
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
