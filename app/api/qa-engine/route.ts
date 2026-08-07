import { streamObject, jsonSchema } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
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
// Centro de Security QA — Motor de IA isolado (Bounded Context).
//
// Pipeline: download evidência (qa-temp-evidences) → streamObject (Gemini)
// → compressão GZIP (zlib nativo) → upload .gz (qa-logs-archive) →
// persistência em qa_results → expurgo do dado bruto (data purge).
//
// O expurgo do bucket temporário só acontece DEPOIS da confirmação do
// upload do .gz no bucket de arquivamento. Evidência nunca é perdida.
// ============================================================================

export const runtime = 'nodejs';
// Vercel: limite de execução da função (Hobby libera até 60s).
export const maxDuration = 60;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

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
1. Avalie cada requisito do escopo e classifique em "conforme" (evidência demonstra implementação), "parcial" (implementação incompleta ou evidência insuficiente) ou "nao_conforme" (ausente ou contradito pela evidência).
2. compliancePercent = (requisitos conforme + 0.5 * requisitos parcial) / total de requisitos * 100, arredondado para 1 casa decimal.
3. overallRating: < 50 => "critico" | 50 a 69 => "alto" | 70 a 84 => "medio" | >= 85 => "baixo".
4. executiveSummary: sumário executivo em português (pt-BR), máximo 200 palavras, linguagem de gestão/risco, sem jargão técnico excessivo.
5. Para cada finding, use requirementId exatamente como citado no escopo, requirementName curto, evidence citando o trecho/sistema da evidência, e recommendation objetiva e acionável.
6. Se o relatório não contiver dados suficientes, marque os requisitos como "nao_conforme" e deixe isso claro no sumário.
7. Não invente requisitos fora do escopo fornecido.
8. Responda APENAS com o JSON conforme o schema.`;

function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
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

    // Limite defensivo de contexto (evita estourar o prompt/token do modelo).
    const evidence = text.length > 200_000 ? text.slice(0, 200_000) : text;

    const encoder = new TextEncoder();
    const emit = (event: QaStreamEvent) =>
      encoder.encode(JSON.stringify(event) + '\n');

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: QaStreamEvent) => controller.enqueue(emit(event));

        try {
          send({ type: 'status', phase: 'analysis', message: 'Cruzando vulnerabilidades do relatório com os requisitos via Gemini...' });

          // 2) Streaming do objeto estruturado da IA em tempo real.
          const result = streamObject({
            model: google(QA_MODEL_ID),
            schema: ANALYSIS_SCHEMA,
            system: SYSTEM_PROMPT,
            prompt: `[REQUISITOS]\n${requirements}\n\n[RELATÓRIO DE SEGURANÇA]\n${evidence}\n\nCruce os requisitos com as evidências e devolva o JSON conforme o schema.`,
            temperature: 0.2,
            maxOutputTokens: 8192,
          });

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
          send({ type: 'status', phase: 'archive', message: 'Comprimindo evidência original (zlib/GZIP) e enviando para qa-logs-archive...' });

          const archivedPath = `${slugify(projectName)}/${Date.now()}-${safeFileName(fileName)}.gz`;
          const { archivedPath: path, gzSizeBytes, originalSizeBytes } = await archiveGzippedEvidence(text, archivedPath);

          // 3.1) URL assinada da evidência arquivada (persistida em qa_results).
          const archivedFileUrl = await getArchivedSignedUrl(path);

          // 3.2) Persistência do resultado + referência à evidência comprimida.
          const persisted = await insertQaResult({
            projectName,
            environmentUrl,
            requirements,
            originalFileName: fileName,
            tempStoragePath: storagePath!,
            archivedFilePath: path,
            archivedFileUrl,
            archivedSizeBytes: gzSizeBytes,
            originalSizeBytes,
            analysis,
            createdBy: null,
          });

          // 4) Data purge: expurga o dado bruto SOMENTE após o arquivo .gz
          //    estar confirmado no bucket de arquivamento.
          send({ type: 'status', phase: 'purge', message: 'Expurgando evidência bruta do bucket temporário (qa-temp-evidences)...' });
          await purgeTemporaryEvidence(storagePath!);
          storagePath = null;

          send({ type: 'done', result: persisted });
        } catch (err) {
          // Se algo falhar ANTES do expurgo, o dado bruto permanece no bucket
          // temporário (não há perda de evidência).
          const message = err instanceof Error ? err.message : 'Erro desconhecido no pipeline de QA.';
          console.error('[qa-engine] pipeline error:', err);
          send({ type: 'error', message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[qa-engine] request error:', error);
    return Response.json(
      { error: 'Erro interno ao processar a análise de segurança.' },
      { status: 500 }
    );
  }
}
