/**
 * Worker de background — Rotina diária de retenção dos logs de auditoria.
 *
 * Executa todo dia às 03:00 (UTC):
 *   1. Arquivamento: logs > 7 dias são comprimidos em GZIP (por dia) e movidos
 *      de public.audit_logs (hot) para public.audit_logs_archive (frio),
 *      liberando a janela de busca próxima e minimizando a storage;
 *   2. Expurgo: arquivos com > 90 dias SÓ são excluídos com consentimento
 *      válido de marcus.goncalves (audit_purge_consent). Sem consentimento,
 *      o job reporta o expurgo como pendente (awaitingConsent) e não apaga nada.
 */
import { inngest } from "@/lib/inngest/client";
import {
  archiveAuditLogs,
  purgeArchivedAuditLogs,
  AUDIT_HOT_RETENTION_DAYS,
  AUDIT_ARCHIVE_RETENTION_DAYS,
} from "@/lib/audit/retention";

export const auditRetentionJob = inngest.createFunction(
  {
    id: "audit-retention-job",
    name: "Retenção de Logs de Auditoria (Arquivo GZIP + Expurgo com Consentimento)",
    triggers: { cron: "0 3 * * *" },
    retries: 3,
  },
  async ({ step }) => {
    const archive = await step.run("archive-expired-hot-logs", async () => {
      try {
        return await archiveAuditLogs(AUDIT_HOT_RETENTION_DAYS);
      } catch (err) {
        console.error("[Audit Retention] Falha ao arquivar logs:", err);
        return { archivedDays: 0, archivedRows: 0, error: err instanceof Error ? err.message : String(err) };
      }
    });

    const purge = await step.run("purge-expired-archive", async () => {
      try {
        return await purgeArchivedAuditLogs(AUDIT_ARCHIVE_RETENTION_DAYS);
      } catch (err) {
        console.error("[Audit Retention] Falha ao expurgar arquivo:", err);
        return { purged: 0, awaitingConsent: false, pendingDays: 0, error: err instanceof Error ? err.message : String(err) };
      }
    });

    return {
      hotWindowDays: AUDIT_HOT_RETENTION_DAYS,
      archiveWindowDays: AUDIT_ARCHIVE_RETENTION_DAYS,
      archive,
      purge,
    };
  }
);
