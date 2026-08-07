import { streamObject, jsonSchema, type LanguageModel } from 'ai';
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
import type { QaAnalysis, QaStreamEvent } from '@/lib/security-qa/types';

// ============================================================================
// Centro de Security QA — Motor de IA Isolado (Bounded Context Multiagente).
//
// Pipeline: download evidência (qa-temp-evidences) → Roteador Multiagente
// (Groq -> OpenRouter -> Google Gemini) → streamObject com schema JSON →
// compressão GZIP (zlib nativo) → upload .gz (qa-logs-archive) →
// persistência em qa_results → expurgo do dado bruto (data purge).
// ============================================================================

export const runtime = 'nodejs';
export const maxDuration = 60;

function resolveApiKey(names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() !== '' && !value.includes('your_')) {
      return value.trim();
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
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
    modelIds: [QA_MODEL_ID, 'gemini-2.0-flash-lite', 'gemini-1.5-flash-latest', 'gemini-2.5-flash'],
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
    // Limita a evidência a 40.000 caracteres (~10k tokens).
    // Evita estouro de 60s e acelera o streaming de 50s para ~3s.
    const evidence = text.length > 40_000 ? text.slice(0, 40_000) + '\n\n[CONTEÚDO DEMAIS RESUMIDO DEFENSIVAMENTE PARA VELOCIDADE]' : text;

    const encoder = new TextEncoder();
    const emit = (event: QaStreamEvent) =>
      encoder.encode(JSON.stringify(event) + '\n');

    const activeStoragePath = storagePath;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: QaStreamEvent) => controller.enqueue(emit(event));

        try {
          send({ type: 'status', phase: 'analysis', message: 'Iniciando esteira multiagente de análise de segurança...' });

          let result: any = null;
          let activeAgentLabel = '';
          const failures: string[] = [];

          // Loop do Roteador Multiagente (Groq -> OpenRouter -> Google Gemini)
          for (const agent of AGENTS) {
            const apiKey = resolveApiKey(agent.envKeys);
            if (!apiKey) {
              failures.push(`${agent.label}: chave de API ausente`);
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

                const streamRes = streamObject({
                  model: modelFactory(modelId),
                  schema: ANALYSIS_SCHEMA,
                  system: SYSTEM_PROMPT,
                  prompt: `[REQUISITOS]\n${requirements}\n\n[RELATÓRIO DE SEGURANÇA]\n${evidence}\n\nCruce os requisitos com as evidências e devolva o JSON conforme o schema.`,
                  temperature: 0.2,
                  maxOutputTokens: 4096,
                });

                // Disparo EAGER da chamada HTTP para validar 404/429/5xx antes do loop
                await streamRes.response;

                result = streamRes;
                activeAgentLabel = `${agent.label} (${modelId})`;
                console.log(`[Security QA] Agente ativo: ${activeAgentLabel}`);
                break;
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                failures.push(`${agent.label} (${modelId}): ${msg}`);
                console.warn(`[Security QA] Falha no modelo "${modelId}": ${msg}. Tentando próximo...`);
              }
            }

            if (result) break;
          }

          if (!result) {
            throw new Error(`Nenhum agente de IA respondeu com sucesso. Falhas: ${failures.join(' | ')}`);
          }

          let partial: Partial<QaAnalysis> = {};
          for await (const delta of result.partialObjectStream) {
            partial = delta as Partial<QaAnalysis>;
            send({ type: 'delta', partial });
          }
          const analysis = (await result.object) as QaAnalysis;

          if (!analysis || typeof analysis.compliancePercent !== 'number') {
            throw new Error('O motor de IA não retornou uma análise estruturada válida.');
          }

          // 3) Cold storage preparation: comprime o texto ORIGINAL em GZIP.
          send({ type: 'status', phase: 'archive', message: 'Comprimindo evidência bruta com GZIP e gerando hash forense...' });
          const { archivedPath, gzSizeBytes, originalSizeBytes } =
            await archiveGzippedEvidence(text, activeStoragePath);

          const archivedUrl = await getArchivedSignedUrl(archivedPath);

          // 4) Gravando o resultado consolidado no Supabase.
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
