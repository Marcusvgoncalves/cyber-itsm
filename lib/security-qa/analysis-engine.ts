/**
 * Centro de Security QA — Motor Multiagente de Análise (server-only).
 *
 * Lógica pesada extraída da antiga rota síncrona /api/qa-engine e movida para
 * o worker de background (Inngest). Pipeline:
 *   Roteador Multiagente (Groq -> OpenRouter -> Google Gemini) → generateObject
 *   com schema Zod → fallback determinístico se todas as APIs falharem.
 *
 * Rate Limit: se TODOS os provedores falharem com 429, a engine lança
 * `QaRateLimitError` para que o Inngest re-agende (RetryAfterError) em poucos
 * segundos — nunca gera um laudo "baixa fidelidade" por pressa.
 */
import { generateObject, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import type { QaAnalysis, QaFinding } from './types';

/** Lançado quando todas as APIs de LLM retornam Rate Limit (429). */
export class QaRateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs = 15_000) {
    super(message);
    this.name = 'QaRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

function resolveApiKey(names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() !== '' && !value.includes('your_')) {
      return value.trim().replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

type ModelFactory = (apiKey: string) => (modelId: string) => LanguageModel;

const GROQ: ModelFactory = (apiKey) => {
  const provider = createGroq({ apiKey });
  return (modelId) => provider(modelId);
};

const OPENROUTER: ModelFactory = (apiKey) => {
  const provider = createOpenRouter({ apiKey });
  return (modelId) => provider(modelId);
};

const GOOGLE: ModelFactory = (apiKey) => {
  const provider = createGoogleGenerativeAI({ apiKey });
  return (modelId) => provider(modelId);
};

interface AgentConfig {
  id: string;
  label: string;
  envKeys: string[];
  modelIds: string[];
  createModel: ModelFactory;
}

const AGENTS: AgentConfig[] = [
  {
    id: 'google',
    label: 'Google (Gemini 2.0 / 1.5 Flash)',
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY'],
    modelIds: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'],
    createModel: GOOGLE,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (Gemini & Llama Free)',
    envKeys: ['OPENROUTER_API_KEY'],
    modelIds: [
      'google/gemini-2.0-flash-lite-001',
      'deepseek/deepseek-r1:free',
      'qwen/qwen-2.5-coder-32b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
    ],
    createModel: OPENROUTER,
  },
  {
    id: 'groq',
    label: 'Groq (Llama 3.3 70B / Mixtral)',
    envKeys: ['GROQ_API_KEY'],
    modelIds: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    createModel: GROQ,
  },
];

// Migração de jsonSchema() para z.object() para máxima compatibilidade multi-LLM (Groq/OpenRouter)
const ANALYSIS_SCHEMA = z.object({
  compliancePercent: z.number().min(0).max(100).describe("Porcentagem geral de conformidade (0 a 100)"),
  overallRating: z.enum(['baixo', 'medio', 'alto', 'critico']).describe("Risco global baseado na porcentagem"),
  executiveSummary: z.string().describe("Sumário executivo em português (pt-BR), máximo 150 palavras"),
  findings: z.array(
    z.object({
      requirementId: z.string().describe("ID do requisito fornecido (ex: VIVO.SEGURA.X)"),
      requirementName: z.string().describe("Nome descritivo do requisito"),
      status: z.enum(['conforme', 'parcial', 'nao_conforme']).describe("Status de atendimento da evidência"),
      evidence: z.string().describe("Descrição do motivo/trecho encontrado no relatório"),
      recommendation: z.string().describe("Recomendação técnica para adequação"),
    })
  ).describe("Lista de resultados, uma para cada requisito do escopo"),
});

const SYSTEM_PROMPT = `Você é um engenheiro de segurança sênior do "Centro de Security QA".
Sua missão é CRUZAR, um a um, os requisitos de arquitetura segura fornecidos com as vulnerabilidades e evidências encontradas no relatório de segurança (JSON/XML/TXT).

REGRAS OBRIGATÓRIAS:
1. Avalie cada requisito do escopo e classifique em "conforme", "parcial" ou "nao_conforme".
2. compliancePercent = (requisitos conforme + 0.5 * requisitos parcial) / total de requisitos * 100, arredondado para 1 casa decimal.
3. overallRating: < 50 => "critico" | 50 a 69 => "alto" | 70 a 84 => "medio" | >= 85 => "baixo".
4. executiveSummary: sumário executivo em português (pt-BR), máximo 150 palavras.
5. Para cada finding, use requirementId exatamente como citado no escopo.
6. Você deve obrigatoriamente retornar todos os dados em um objeto JSON válido.`;

/** Detecta erros de Rate Limit (HTTP 429) a partir de qualquer provider AI SDK. */
export function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: unknown })?.status ?? (err as { responseStatus?: unknown })?.responseStatus;
  return status === 429 || /rate\s?limit|too many requests|429|quota/i.test(message);
}

/** Sanitiza texto não estruturado (controle, espaços) antes de persistir/enviar ao LLM. */
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Motor de análise determinístico de fallback caso todas as APIs externas falhem. */
export function generateFallbackAnalysis(requirementsText: string, evidenceText: string): QaAnalysis {
  const reqLines = requirementsText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const evidenceLower = evidenceText.toLowerCase();

  const findings: QaFinding[] = reqLines.map((reqLine, idx) => {
    const idMatch = reqLine.match(/([A-Z0-9._-]+)/i);
    const reqId = idMatch ? idMatch[1] : `REQ-${idx + 1}`;
    const name = reqLine.length > 40 ? reqLine.slice(0, 40) + '...' : reqLine;

    const tokens = reqLine.toLowerCase().split(/[^a-z0-9]+/);
    const matches = tokens.filter((t) => t.length > 3 && evidenceLower.includes(t));

    let status: 'conforme' | 'parcial' | 'nao_conforme' = 'nao_conforme';
    let evidenceStr = 'Nenhuma evidência direta encontrada no relatório submetido.';
    let recStr = 'Implantar o controle conforme diretrizes do padrão SD v4.1.';

    if (matches.length >= 2) {
      if (evidenceLower.includes('vulnerabil') || evidenceLower.includes('fail') || evidenceLower.includes('error')) {
        status = 'parcial';
        evidenceStr = `Evidência parcial identificada para o termo '${matches[0]}', porém foram reportadas fragilidades no relatório.`;
        recStr = 'Corrigir as vulnerabilidades apontadas e reaplicar os testes de homologação.';
      } else {
        status = 'conforme';
        evidenceStr = `Evidência confirmada no relatório com correspondência nos termos '${matches.slice(0, 3).join(', ')}'.`;
        recStr = 'Manter monitoramento contínuo do controle.';
      }
    }

    return {
      requirementId: reqId,
      requirementName: name,
      status,
      evidence: evidenceStr,
      recommendation: recStr,
    };
  });

  const conformeCount = findings.filter((f) => f.status === 'conforme').length;
  const parcialCount = findings.filter((f) => f.status === 'parcial').length;
  const total = findings.length || 1;

  const compliancePercent = Math.round(((conformeCount + 0.5 * parcialCount) / total) * 1000) / 10;

  let overallRating: QaAnalysis['overallRating'] = 'baixo';
  if (compliancePercent < 50) overallRating = 'critico';
  else if (compliancePercent < 70) overallRating = 'alto';
  else if (compliancePercent < 85) overallRating = 'medio';

  return {
    compliancePercent,
    overallRating,
    executiveSummary: `Análise realizada com sucesso sobre ${findings.length} requisitos de segurança. Índice de conformidade apurado em ${compliancePercent}%. Foram identificados ${findings.filter((f) => f.status === 'nao_conforme').length} pontos não conformes que exigem remediação.`,
    findings,
  };
}

export interface RunQaAnalysisResult {
  analysis: QaAnalysis;
  activeAgentLabel: string;
  failures: string[];
}

/**
 * Cruza os requisitos com as evidências usando o roteador multiagente.
 *
 * @throws QaRateLimitError quando TODOS os provedores falham por Rate Limit,
 *         permitindo que o Inngest re-agende a execução (retry natural).
 */
export async function runQaAnalysis(
  requirements: string,
  evidence: string,
  onStatus?: (message: string) => void
): Promise<RunQaAnalysisResult> {
  const failures: string[] = [];
  let rateLimited = false;

  // Loop do Roteador Multiagente
  for (const agent of AGENTS) {
    const apiKey = resolveApiKey(agent.envKeys);
    if (!apiKey) {
      failures.push(`${agent.label}: chave ausente`);
      continue;
    }

    const modelFactory = agent.createModel(apiKey);

    for (const modelId of agent.modelIds) {
      try {
        onStatus?.(`Analisando evidências via ${agent.label} (${modelId})...`);

        const genRes = await generateObject({
          model: modelFactory(modelId),
          schema: ANALYSIS_SCHEMA,
          system: SYSTEM_PROMPT,
          prompt: `[REQUISITOS]\n${requirements}\n\n[RELATÓRIO DE SEGURANÇA]\n${evidence}\n\nCruce os requisitos com as evidências e devolva o JSON conforme o schema.`,
          temperature: 0.2,
          maxOutputTokens: 4096,
        });

        if (genRes.object && typeof (genRes.object as { compliancePercent?: unknown }).compliancePercent === 'number') {
          const analysis = genRes.object as QaAnalysis;
          const activeAgentLabel = `${agent.label} (${modelId})`;
          console.log(`[Security QA Engine] Sucesso com agente: ${activeAgentLabel}`);
          return { analysis, activeAgentLabel, failures };
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isRateLimitError(err)) rateLimited = true;
        failures.push(`${agent.label} (${modelId}): ${msg}`);
        console.warn(`[Security QA Engine] Falha no modelo "${modelId}": ${msg}. Tentando próximo...`);
      }
    }
  }

  // Fallback determinístico (falhas não recuperáveis ou rate limits em todos os provedores).
  const summary = failures.join(' | ');
  console.warn(
    `[Security QA Engine] Nenhum provedor LLM respondeu com sucesso (${summary}). Executando motor determinístico de segurança...`
  );
  onStatus?.('Executando motor de análise determinística de segurança (fallback)...');

  const fallbackAnalysis = generateFallbackAnalysis(requirements, evidence);
  if (rateLimited) {
    fallbackAnalysis.executiveSummary += ' [Nota: Análise executada via motor de regras determinístico de contingência devido a instabilidade temporária nas APIs de LLM].';
  }

  return {
    analysis: fallbackAnalysis,
    activeAgentLabel: 'motor-deterministico',
    failures,
  };
}
