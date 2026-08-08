/**
 * Worker de background — Processa um laudo Security QA de ponta a ponta.
 *
 * Movido para o Inngest para eliminar o gargalo síncrono do /api/qa-engine:
 *   1. Carrega o QaResult (criado pelo publisher em status PROCESSANDO);
 *   2. Baixa e parseia a evidência bruta do bucket temporário;
 *   3. Roda o motor multiagente (Groq -> OpenRouter -> Gemini) cruzando os
 *      requisitos com as evidências;
 *   4. Comprime a evidência (GZIP forense) e arquiva em qa-logs-archive;
 *   5. Gera o PDF do laudo (@react-pdf/renderer) e salva em qa-pdf-reports;
 *   6. UPDATE no banco: status -> 'CONCLUIDO' + campos de conformidade.
 *
 * Retry natural (Inngest): erros transientes re-executam os steps a partir do
 * ponto de falha. Rate Limit do LLM é traduzido para RetryAfterError (falha
 * graciosa) — o Inngest reagenda em poucos segundos em vez de gerar laudo com
 * o fallback determinístico.
 */
import { NonRetriableError, RetryAfterError, type FailureEventArgs } from "inngest";
import { z } from "zod";
import { inngest } from "@/lib/inngest/client";
import { runQaAnalysis, QaRateLimitError } from "@/lib/security-qa/analysis-engine";
import {
  ensureQaBuckets,
  downloadEvidenceText,
  archiveGzippedEvidence,
  getArchivedSignedUrl,
  purgeTemporaryEvidence,
  uploadQaPdfReport,
} from "@/lib/security-qa/storage";
import {
  getQaResultById,
  completeQaResult,
  failQaResult,
} from "@/lib/security-qa/qaRepository";
import { generateProjectPdfBuffer } from "@/lib/security-qa/export-project-pdf";
import type { QaAnalysis, QaResult } from "@/lib/security-qa/types";

// ----------------------------------------------------------------------------
// Schema Zod do payload do evento (tipagem estrita do contrato publisher -> worker).
// ----------------------------------------------------------------------------
export const ProcessQaReportEventSchema = z.object({
  /** ID do registro em public.qa_results criado pelo publisher. */
  qaResultId: z.string().min(1),
  /** Caminho do objeto no bucket temporário qa-temp-evidences. */
  fileUrl: z.string().min(1),
});

export type ProcessQaReportEventData = z.infer<typeof ProcessQaReportEventSchema>;

/** Trunca o contexto enviado ao LLM (anti-timeout para modelos de contexto curto). */
const MAX_LLM_CONTEXT_CHARS = 35_000;

function truncateForLlm(text: string): string {
  if (text.length <= MAX_LLM_CONTEXT_CHARS) return text;
  return text.slice(0, MAX_LLM_CONTEXT_CHARS) + '\n\n[CONTEÚDO RESUMIDO DEFENSIVAMENTE PARA PERFORMANCE]';
}

export const processQaReport = inngest.createFunction(
  {
    id: "qa-process-report",
    name: "Processar Relatório Security QA (Background)",
    triggers: { event: "qa/process.report" },
    retries: 5,
    concurrency: { limit: 5 },
    onFailure: async ({ event, error }: FailureEventArgs) => {
      const originalEvent = event.data.event as { data?: { qaResultId?: unknown } } | undefined;
      const qaResultId = originalEvent?.data?.qaResultId;
      if (typeof qaResultId !== "string") return;

      try {
        await failQaResult(qaResultId, error.message);
        console.error(`[Worker QA] Laudo ${qaResultId} marcado como FALHA:`, error.message);
      } catch (markErr) {
        console.error(`[Worker QA] Falha ao marcar laudo ${qaResultId} como FALHA:`, markErr);
      }
    },
  },
  async ({ event, step }) => {
    const parsed = ProcessQaReportEventSchema.safeParse(event.data);
    if (!parsed.success) {
      throw new NonRetriableError("Evento 'qa/process.report' inválido.", {
        cause: parsed.error.flatten(),
      });
    }

    const { qaResultId, fileUrl } = parsed.data;
    const storagePath = fileUrl;

    // 1) Carrega o laudo pendente.
    const loaded = await step.run("load-qa-result", async () => {
      const result = await getQaResultById(qaResultId);
      if (!result) {
        throw new NonRetriableError(`QaResult '${qaResultId}' não encontrado.`);
      }
      if (result.status !== "PROCESSANDO") {
        // Idempotência: um retry tardio não pode reprocessar um laudo já concluído.
        throw new NonRetriableError(
          `QaResult '${qaResultId}' já está em '${result.status}'. Execução ignorada.`
        );
      }
      return result;
    });

    // 2) Baixa + parseia a evidência (JSON/XML/TXT/PDF/DOCX/imagem).
    const downloaded = await step.run("download-evidence", async () => {
      await ensureQaBuckets();
      const { text } = await downloadEvidenceText(storagePath);
      return { text, evidence: truncateForLlm(text) };
    });

    // 3) Motor multiagente: cruza os requisitos com as evidências.
    const analyzed = await step.run("run-multiagent-analysis", async () => {
      try {
        const { analysis } = await runQaAnalysis(
          loaded.requirements,
          downloaded.evidence,
          (message) => console.log(`[Worker QA ${qaResultId}] ${message}`)
        );
        return analysis;
      } catch (err) {
        // Rate limit em TODOS os provedores: falha graciosa -> Inngest reagenda.
        if (err instanceof QaRateLimitError) {
          throw new RetryAfterError(err.message, err.retryAfterMs, { cause: err });
        }
        throw err;
      }
    });

    // 4) Arquivamento forense: GZIP da evidência original + URL assinada.
    const archived = await step.run("archive-evidence", async () => {
      const { archivedPath, gzSizeBytes, originalSizeBytes } =
        await archiveGzippedEvidence(downloaded.text, storagePath);
      const archivedUrl = await getArchivedSignedUrl(archivedPath);
      return { archivedPath, archivedUrl, gzSizeBytes, originalSizeBytes };
    });

    // 5) Gera o PDF do laudo e salva no Supabase Storage (qa-pdf-reports).
    const pdf = await step.run("generate-and-upload-pdf", async () => {
      const resultForPdf: QaResult = {
        id: loaded.id,
        project_name: loaded.project_name,
        environment_url: loaded.environment_url,
        requirements: loaded.requirements,
        original_file_name: loaded.original_file_name,
        temp_storage_path: loaded.temp_storage_path,
        archived_file_path: archived.archivedPath,
        archived_file_url: archived.archivedUrl,
        archived_size_bytes: archived.gzSizeBytes,
        original_size_bytes: archived.originalSizeBytes,
        compression_ratio:
          archived.originalSizeBytes > 0
            ? archived.gzSizeBytes / archived.originalSizeBytes
            : null,
        compliance_percent: analyzed.compliancePercent,
        overall_rating: analyzed.overallRating,
        executive_summary: analyzed.executiveSummary,
        findings: analyzed.findings,
        status: "CONCLUIDO",
        error_message: null,
        pdf_file_path: null,
        pdf_file_url: null,
        created_by: loaded.created_by,
        created_at: loaded.created_at,
      };

      const pdfBuffer = await generateProjectPdfBuffer(resultForPdf);
      return await uploadQaPdfReport(pdfBuffer, loaded.id);
    });

    // 6) UPDATE no banco: promove para CONCLUIDO e popula a conformidade.
    await step.run("mark-completed", async () => {
      const completed: QaAnalysis = analyzed;
      await completeQaResult(loaded.id, {
        archivedFilePath: archived.archivedPath,
        archivedFileUrl: archived.archivedUrl,
        archivedSizeBytes: archived.gzSizeBytes,
        originalSizeBytes: archived.originalSizeBytes,
        analysis: completed,
        pdfFilePath: pdf.pdfFilePath,
        pdfFileUrl: pdf.pdfFileUrl,
      });
    });

    // 7) Expurga a evidência bruta do bucket temporário (Zero Data Leak).
    await step.run("purge-temp-evidence", async () => {
      try {
        await purgeTemporaryEvidence(storagePath);
      } catch (err) {
        console.warn(
          `[Worker QA] Falha ao expurgar evidência temporária '${storagePath}':`,
          err
        );
      }
    });

    return {
      qaResultId: loaded.id,
      status: "CONCLUIDO" as const,
      compliancePercent: analyzed.compliancePercent,
      overallRating: analyzed.overallRating,
      pdfFileUrl: pdf.pdfFileUrl,
    };
  }
);
