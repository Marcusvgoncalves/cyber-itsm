import { generateText, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

// ============================================================================
// ROTEADOR MULTIAGENTE (módulo ADITIVO, usado apenas pelo llm-proxy).
//
// Espelha a esteira gratuita do /api/chat, mas em módulo isolado — NÃO toca na
// rota existente (Zero impacto). Prioridade de execução:
//   1. Groq        → llama-3.1-8b-instant
//   2. OpenRouter  → deepseek/deepseek-r1:free
//   3. Google      → gemini-2.0-flash-lite
// Se um provedor falhar (ex.: 429), o próximo agente é tentado imediatamente.
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
}

const AGENTS: AgentConfig[] = [
  {
    id: 'groq',
    label: 'Groq',
    envKeys: ['GROQ_API_KEY'],
    modelId: 'llama-3.1-8b-instant',
    createModel: (apiKey) => (modelId) => createGroq({ apiKey })(modelId),
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    envKeys: ['OPENROUTER_API_KEY'],
    modelId: 'deepseek/deepseek-r1:free',
    createModel: (apiKey) => (modelId) => createOpenRouter({ apiKey })(modelId),
  },
  {
    id: 'google',
    label: 'Google',
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    modelId: 'gemini-2.0-flash-lite',
    createModel: (apiKey) => (modelId) => createGoogleGenerativeAI({ apiKey })(modelId),
    temperature: 0.7,
  },
];

export type AgentRouterResult = {
  provider: string;
  model: string;
  response: string;
};

/**
 * Roda o prompt através dos agentes em cascata e devolve o primeiro sucesso.
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
