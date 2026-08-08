import { runQaAnalysis } from "./analysis-engine";
import {
  ensureQaBuckets,
  downloadEvidenceText,
  archiveGzippedEvidence,
  getArchivedSignedUrl,
  purgeTemporaryEvidence,
  uploadQaPdfReport,
} from "./storage";
import {
  getQaResultById,
  completeQaResult,
  failQaResult,
} from "./qaRepository";
import { generateProjectPdfBuffer } from "./export-project-pdf";
import type { QaResult } from "./types";

/**
 * Executa o processamento do laudo Security QA in-memory em segundo plano.
 * Serve como mecanismo de resiliência e fallback automático de Zero Downtime
 * caso o orquestrador de filas (Inngest) não esteja ativo ou configurado.
 */
export async function runLocalQaProcess(qaResultId: string, fileUrl: string) {
  try {
    console.log(`[Local Fallback Worker] Iniciando processamento do laudo ${qaResultId} em segundo plano...`);

    // 1) Carrega o laudo pendente
    const loaded = await getQaResultById(qaResultId);
    if (!loaded) {
      throw new Error(`Laudo ${qaResultId} não encontrado.`);
    }
    if (loaded.status !== "PROCESSANDO") {
      console.log(`[Local Fallback Worker] Laudo ${qaResultId} já está em status '${loaded.status}'.`);
      return;
    }

    // 2) Baixa e parseia a evidência temporária
    await ensureQaBuckets();
    const { text } = await downloadEvidenceText(fileUrl);

    // Trunca a evidência para evitar limites de token e timeout
    const truncatedEvidence =
      text.length > 35_000
        ? text.slice(0, 35_000) + "\n\n[CONTEÚDO RESUMIDO DEFENSIVAMENTE PARA PERFORMANCE]"
        : text;

    // 3) Executa a análise através da esteira de IA
    const { analysis } = await runQaAnalysis(
      loaded.requirements,
      truncatedEvidence,
      (message) => console.log(`[Local Worker ${qaResultId}] ${message}`)
    );

    // 4) Cria o arquivamento forense
    const { archivedPath, gzSizeBytes, originalSizeBytes } =
      await archiveGzippedEvidence(text, fileUrl);
    const archivedUrl = await getArchivedSignedUrl(archivedPath);

    // 5) Compila o laudo em formato PDF
    const resultForPdf: QaResult = {
      ...loaded,
      archived_file_path: archivedPath,
      archived_file_url: archivedUrl,
      archived_size_bytes: gzSizeBytes,
      original_size_bytes: originalSizeBytes,
      compression_ratio: originalSizeBytes > 0 ? gzSizeBytes / originalSizeBytes : null,
      compliance_percent: analysis.compliancePercent,
      overall_rating: analysis.overallRating,
      executive_summary: analysis.executiveSummary,
      findings: analysis.findings,
      status: "CONCLUIDO",
    };

    const pdfBuffer = await generateProjectPdfBuffer(resultForPdf);
    const pdf = await uploadQaPdfReport(pdfBuffer, loaded.id);

    // 6) Atualiza o status e metadados no banco de dados (Prisma)
    await completeQaResult(loaded.id, {
      archivedFilePath: archivedPath,
      archivedFileUrl: archivedUrl,
      archivedSizeBytes: gzSizeBytes,
      originalSizeBytes: originalSizeBytes,
      analysis,
      pdfFilePath: pdf.pdfFilePath,
      pdfFileUrl: pdf.pdfFileUrl,
    });

    // 7) Expurgar evidências temporárias (Zero Data Leak)
    try {
      await purgeTemporaryEvidence(fileUrl);
    } catch (err) {
      console.warn(`[Local Fallback Worker] Falha ao expurgar evidência temporária '${fileUrl}':`, err);
    }

    console.log(`[Local Fallback Worker] Laudo ${qaResultId} processado e concluído com sucesso!`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Local Fallback Worker Error] Falha ao processar laudo ${qaResultId}:`, err);
    await failQaResult(qaResultId, message).catch((markErr) => {
      console.error(`[Local Fallback Worker] Falha ao marcar status de erro para ${qaResultId}:`, markErr);
    });
  }
}
