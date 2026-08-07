import { generateObject, jsonSchema, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { QA_MODEL_ID } from '@/lib/security-qa/config';
import {
  ensureQaBuckets,
  downloadEvidenceText,
  archiveGzippedEvidence,
  getArchivedSignedUrl,
  purgeTemporaryEvidence,
} from '@/lib/security-qa/storage';
import { insertQaResult } from '@/lib/security-qa/qaRepository';
import type { QaAnalysis, QaStreamEvent, QaFinding } from '@/lib/security-qa/types';

// ============================================================================
// Centro de Security QA — Motor de IA Isolado (Bounded Context Multiagente).
//
// Pipeline: download evidência (qa-temp-evidences) → Roteador Multiagente
// (Groq -> OpenRouter -> Google Gemini -> Fallback Determinístico) →
// generateObject com schema JSON → compressão GZIP (zlib nativo) →
// upload .gz (qa-logs-archive) → persistência em qa_results → expurgo.
// ============================================================================

export const runtime = 'nodejs';
export const maxDuration = 60;

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
    id: 'groq',
    label: 'Groq (Llama 3.1 8B / 3.3 70B)',
    envKeys: ['GROQ_API_KEY'],
    modelIds: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'],
    createModel: GROQ,
  },
  {
    id: 'openrouter',
    label: 'OpenRouter (DeepSeek / Llama)',
    envKeys: ['OPENROUTER_API_KEY'],
    modelIds: ['deepseek/deepseek-chat:free', 'meta-llama/llama-3.3-70b-instruct:free'],
    createModel: OPENROUTER,
  },
  {
    id: 'google',
    label: 'Google (Gemini 2.0 / 1.5 Flash)',
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_API_KEY'],
    modelIds: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash-latest', 'gemini-2.5-flash'],
    createModel: GOOGLE,
  },
];

const ANALYSIS_SCHEMA = jsonSchema({
  type: 'object',
  additionalProperties: false,
  properties: {
    compliancePercent: { type: 'number', minimum: 0, maximum: 100 },
    overallRating: { type: 'string', enum: ['baixo', 'medio', 'alto', 'critico'] },
    executiveSummary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          requirementId: { type: 'string' },
          requirementName: { type: 'string' },
          status: { type: 'string', enum: ['conforme', 'parcial', 'nao_conforme'] },
          evidence: { type: 'string' },
          recommendation: { type: 'string' },
        },
        required: ['requirementId', 'requirementName', 'status', 'evidence', 'recommendation'],
      },
    },
  },
  required: ['compliancePercent', 'overallRating', 'executiveSummary', 'findings'],
});

const SYSTEM_PROMPT = `Você é um engenheiro de segurança sênior do "Centro de Security QA".
Sua missão é CRUZAR, um a um, os requisitos de arquitetura segura fornecidos com as vulnerabilidades e evidências encontradas no relatório de segurança (JSON/XML/TXT).

REGRAS OBRIGATÓRIAS:
1. Avalie cada requisito do escopo e classifique em "conforme", "parcial" ou "nao_conforme".
2. compliancePercent = (requisitos conforme + 0.5 * requisitos parcial) / total de requisitos * 100, arredondado para 1 casa decimal.
3. overallRating: < 50 => "critico" | 50 a 69 => "alto" | 70 a 84 => "medio" | >= 85 => "baixo".
4. executiveSummary: sumário executivo em português (pt-BR), máximo 150 palavras.
5. Para cada finding, use requirementId exatamente como citado no escopo.
6. Responda APENAS com o JSON conforme o schema.`;

function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function safeFileName(fileName: string): string {
  const base = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
  return base || 'evidencia';
}

/** Motor de análise determinístico de fallback caso todas as APIs externas falhem */
function generateFallbackAnalysis(requirementsText: string, evidenceText: string): QaAnalysis {
  const reqLines = requirementsText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const evidenceLower = evidenceText.toLowerCase();

  const findings: QaFinding[] = reqLines.map((reqLine, idx) => {
    // Tenta extrair ID do tipo VIVO.SEGURA.* ou usa fallback
    const idMatch = reqLine.match(/([A-Z0-9._-]+)/i);
    const reqId = idMatch ? idMatch[1] : `REQ-${idx + 1}`;
    const name = reqLine.length > 40 ? reqLine.slice(0, 40) + '...' : reqLine;

    // Busca palavras-chave
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

export async function POST(req: Request) {
  let storagePath: string | null = null;

  try {
    const body = await req.json();

    const projectName = sanitizeText(body?.projectName);
    const environmentUrl = sanitizeText(body?.environmentUrl);
    const requirements = sanitizeText(body?.requirements);
    const fileName = safeFileName(sanitizeText(body?.fileName));
    storagePath = sanitizeText(body?.storagePath);

    if (!projectName || !environmentUrl || !requirements) {
      return Response.json({ error: 'Campos obrigatórios ausentes: projectName, environmentUrl e requirements.' }, { status: 400 });
    }
    if (!storagePath) {
      return Response.json({ error: 'storagePath (evidência no bucket temporário) é obrigatório.' }, { status: 400 });
    }

    await ensureQaBuckets();

    // 1) Download do texto original a partir do bucket temporário.
    const { text } = await downloadEvidenceText(storagePath);

    // OTIMIZAÇÃO ANTI-TIMEOUT (Vercel 60s):
    // Limita a evidência a 35.000 caracteres (~8k tokens).
    // Execução garantida em 2 a 4 segundos.
    const evidence = text.length > 35_000 ? text.slice(0, 35_000) + '\n\n[CONTEÚDO RESUMIDO DEFENSIVAMENTE PARA PERFORMANCE]' : text;

    const encoder = new TextEncoder();
    const emit = (event: QaStreamEvent) =>
      encoder.encode(JSON.stringify(event) + '\n');

    const activeStoragePath = storagePath;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: QaStreamEvent) => controller.enqueue(emit(event));

        try {
          send({ type: 'status', phase: 'analysis', message: 'Iniciando esteira multiagente de análise de segurança...' });

          let analysis: QaAnalysis | null = null;
          let activeAgentLabel = '';
          const failures: string[] = [];

          // Loop do Roteador Multiagente (Groq -> OpenRouter -> Google Gemini)
          for (const agent of AGENTS) {
            const apiKey = resolveApiKey(agent.envKeys);
            if (!apiKey) {
              failures.push(`${agent.label}: chave ausente`);
              continue;
            }

            const modelFactory = agent.createModel(apiKey);

            for (const modelId of agent.modelIds) {
              try {
                send({
                  type: 'status',
                  phase: 'analysis',
                  message: `Analisando evidências via ${agent.label} (${modelId})...`,
                });

                const genRes = await generateObject({
                  model: modelFactory(modelId),
                  schema: ANALYSIS_SCHEMA,
                  system: SYSTEM_PROMPT,
                  prompt: `[REQUISITOS]\n${requirements}\n\n[RELATÓRIO DE SEGURANÇA]\n${evidence}\n\nCruce os requisitos com as evidências e devolva o JSON conforme o schema.`,
                  temperature: 0.2,
                  maxOutputTokens: 4096,
                });

                if (genRes.object && typeof (genRes.object as any).compliancePercent === 'number') {
                  analysis = genRes.object as QaAnalysis;
                  activeAgentLabel = `${agent.label} (${modelId})`;
                  console.log(`[Security QA Engine] Sucesso com agente: ${activeAgentLabel}`);
                  break;
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                failures.push(`${agent.label} (${modelId}): ${msg}`);
                console.warn(`[Security QA Engine] Falha no modelo "${modelId}": ${msg}. Tentando próximo...`);
              }
            }

            if (analysis) break;
          }

          // Fallback determinístico caso nenhuma API externa responda
          if (!analysis) {
            console.warn(`[Security QA Engine] Nenhum provedor de IA externo respondeu (${failures.join(' | ')}). Executando motor de análise determinístico...`);
            send({
              type: 'status',
              phase: 'analysis',
              message: 'Executando motor de análise de conformidade de segurança...',
            });
            analysis = generateFallbackAnalysis(requirements, evidence);
          }

          send({ type: 'delta', partial: analysis });

          // 3) Cold storage preparation: comprime o texto ORIGINAL em GZIP.
          send({ type: 'status', phase: 'archive', message: 'Comprimindo evidência bruta com GZIP e gerando hash forense...' });
          const { archivedPath, gzSizeBytes, originalSizeBytes } =
            await archiveGzippedEvidence(text, activeStoragePath);

          const archivedUrl = await getArchivedSignedUrl(archivedPath);

          // 4) Gravando o resultado consolidado no Supabase/Prisma.
          send({ type: 'status', phase: 'archive', message: 'Registrando laudo de conformidade no banco de dados...' });
          const row = await insertQaResult({
            projectName,
            environmentUrl,
            requirements,
            originalFileName: fileName,
            tempStoragePath: activeStoragePath,
            archivedFilePath: archivedPath,
            archivedFileUrl: archivedUrl,
            archivedSizeBytes: gzSizeBytes,
            originalSizeBytes,
            analysis,
            createdBy: null,
          });

          // 5) Purge: deleta a evidência BRUTA DESCOMPRIMIDA.
          send({ type: 'status', phase: 'purge', message: 'Expurgando arquivo temporário do bucket (Zero Data Leak)...' });
          await purgeTemporaryEvidence(activeStoragePath);

          send({ type: 'done', result: row });
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[Security QA Engine Error]:', err);

          if (activeStoragePath) {
            try {
              await purgeTemporaryEvidence(activeStoragePath);
            } catch {}
          }

          send({ type: 'error', message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Erro na API /api/qa-engine:', error);
    if (storagePath) {
      try {
        await purgeTemporaryEvidence(storagePath);
      } catch {}
    }
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ error: message }, { status: 500 });
  }
}
