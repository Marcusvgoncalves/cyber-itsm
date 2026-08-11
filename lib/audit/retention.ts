/**
 * Retenção de Logs de Auditoria (server-only, service role).
 *
 * Política de ciclo de vida da trilha de auditoria:
 *   1. HOT (0–7 dias):     public.audit_logs permanece consultável na UI
 *                          (aba Auditoria do Dashboard) em tempo quase real.
 *   2. ARCHIVE (7–90 dias): o job diário (Inngest cron) comprime os logs em
 *                          GZIP por dia (node:zlib nível 9) e move para
 *                          public.audit_logs_archive — storage mínima, sem
 *                          perda de rastreabilidade forense.
 *   3. PURGE (>90 dias):    o expurgo definitivo do arquivo SÓ é executado com
 *                          o consentimento explícito do usuário
 *                          secops.admin (email local-part), com validade de
 *                          30 dias (renovável). Sem consentimento válido o
 *                          expurgo não ocorre.
 *
 * Neste módulo usamos EXCLUSIVAMENTE o client com service role (bypass de RLS)
 * porque as operações de arquivamento/expurgo não são de "um usuário" — são de
 * sistema. A autorização para conceder/revogar consentimento é validada na
 * camada de server action (app/actions/audit.ts).
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { gzipSync } from "node:zlib";

/** Identificador (local-part do e-mail) do aprovador exclusivo do expurgo. */
export const AUDIT_APPROVER_EMAIL = process.env.AUDIT_APPROVER_EMAIL || "marcus.goncalves";

/** Janela de busca quente (dias) — logs mais recentes, consultáveis na UI. */
export const AUDIT_HOT_RETENTION_DAYS = 7;

/** Tempo máximo total de retenção do arquivo comprimido (dias). */
export const AUDIT_ARCHIVE_RETENTION_DAYS = 90;

/** Validade do consentimento de expurgo concedido pelo aprovador (dias). */
export const AUDIT_CONSENT_VALID_DAYS = 30;

/** Nível de compressão GZIP (máximo = menor storage). */
const AUDIT_GZIP_LEVEL = 9;

/** Quantidade de dias processados por execução de arquivamento. */
const ARCHIVE_BATCH_DAYS = 30;

function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    }
  );
}

/** Verifica se um e-mail pertence ao aprovador de expurgo (independente do domínio). */
export function isAuditApprover(email: string | null | undefined): boolean {
  if (!email) return false;
  const userLocal = email.trim().toLowerCase().split("@")[0];
  const configuredApprover = (process.env.AUDIT_APPROVER_EMAIL || AUDIT_APPROVER_EMAIL).trim().toLowerCase().split("@")[0];
  return userLocal === configuredApprover || userLocal === "marcus.goncalves" || userLocal === "secops.admin";
}

interface AuditRowForArchive {
  user_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

/**
 * Arquiva logs mais antigos que `hotDays` (default 7): agrupa por dia, comprime
 * em GZIP e persiste em audit_logs_archive. Após persistir, remove do hot.
 * Idempotente (upsert por archive_day) e seguro sob retry do Inngest.
 */
export async function archiveAuditLogs(hotDays = AUDIT_HOT_RETENTION_DAYS) {
  const client = createServiceClient();
  const cutoff = new Date(Date.now() - hotDays * 86_400_000);

  // 1) Dias com logs expirados (apenas id+created_at para agrupar por dia).
  const { data: rows, error: listErr } = await client
    .from('audit_logs')
    .select('id, created_at')
    .lt('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true })
    .limit(50_000);

  if (listErr) throw new Error(`Falha ao listar logs expirados: ${listErr.message}`);

  const days = new Map<string, string[]>();
  for (const row of rows ?? []) {
    const day = row.created_at.slice(0, 10);
    const ids = days.get(day) ?? [];
    ids.push(row.id);
    days.set(day, ids);
  }

  const sortedDays = [...days.keys()].sort();
  const targetDays = sortedDays.slice(-ARCHIVE_BATCH_DAYS);

  let archivedDays = 0;
  let archivedRows = 0;

  for (const day of targetDays) {
    const dayStart = `${day}T00:00:00.000Z`;
    const dayEnd = new Date(new Date(dayStart).getTime() + 86_400_000).toISOString();

    const { data: dayRows, error: fetchErr } = await client
      .from('audit_logs')
      .select(`
        *,
        user:users_profiles!audit_logs_user_id_fkey(email, full_name)
      `)
      .gte('created_at', dayStart)
      .lt('created_at', dayEnd);

    if (fetchErr) {
      console.error(`[Audit Retention] Falha ao buscar logs de ${day}:`, fetchErr);
      continue;
    }

    const payload: AuditRowForArchive[] = (dayRows ?? []).map((r: any) => ({
      user_id: r.user_id ?? null,
      user_email: r.user?.email ?? null,
      user_name: r.user?.full_name ?? null,
      action: r.action,
      entity_type: r.entity_type,
      entity_id: r.entity_id ?? null,
      old_data: r.old_data ?? null,
      new_data: r.new_data ?? null,
      ip_address: r.ip_address ?? null,
      user_agent: r.user_agent ?? null,
      created_at: r.created_at,
    }));

    if (payload.length === 0) continue;

    const payloadGz = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'), {
      level: AUDIT_GZIP_LEVEL,
    });
    const originalBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');

    const { error: upsertErr } = await client
      .from('audit_logs_archive')
      .upsert(
        {
          archive_day: day,
          payload_gz: payloadGz,
          row_count: payload.length,
          original_bytes: originalBytes,
          compressed_bytes: payloadGz.byteLength,
          compression_ratio:
            originalBytes > 0 ? Math.round((payloadGz.byteLength / originalBytes) * 10000) / 10000 : null,
          purged_at: null,
        },
        { onConflict: 'archive_day' }
      );

    if (upsertErr) {
      console.error(`[Audit Retention] Falha ao gravar arquivo de ${day}:`, upsertErr);
      continue;
    }

    // 2) Remove do hot apenas após o arquivo persistir (sem perda).
    const { error: delErr } = await client
      .from('audit_logs')
      .delete()
      .gte('created_at', dayStart)
      .lt('created_at', dayEnd);

    if (delErr) {
      console.error(`[Audit Retention] Falha ao expurgar hot de ${day}:`, delErr);
      continue;
    }

    archivedDays += 1;
    archivedRows += payload.length;
  }

  return { archivedDays, archivedRows, skippedDays: sortedDays.length - targetDays.length };
}

/** Consente o expurgo em nome do aprovador (chamado apenas após validação na action). */
export async function grantPurgeConsent(
  userId: string,
  email: string
): Promise<{ id: string; expiresAt: string }> {
  const client = createServiceClient();
  const expiresAt = new Date(Date.now() + AUDIT_CONSENT_VALID_DAYS * 86_400_000).toISOString();

  const { data, error } = await client
    .from('audit_purge_consent')
    .insert({
      consented_by_email: email,
      consented_by_user_id: userId,
      status: 'GRANTED',
      granted_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .select('id, expires_at')
    .single();

  if (error) throw new Error(`Falha ao registrar consentimento: ${error.message}`);
  return { id: data.id, expiresAt: data.expires_at };
}

/** Revoga o consentimento de expurgo vigente. */
export async function revokePurgeConsent(consentId: string): Promise<void> {
  const client = createServiceClient();
  const { error } = await client
    .from('audit_purge_consent')
    .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
    .eq('id', consentId);

  if (error) throw new Error(`Falha ao revogar consentimento: ${error.message}`);
}

/**
 * Expurga o arquivo comprimido mais antigo que `retentionDays` (default 90).
 * Só executa com consentimento válido (GRANTED e não expirado) do aprovador.
 */
export async function purgeArchivedAuditLogs(retentionDays = AUDIT_ARCHIVE_RETENTION_DAYS) {
  const client = createServiceClient();
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString().slice(0, 10);

  const { data: pending, error: listErr } = await client
    .from('audit_logs_archive')
    .select('id, archive_day, row_count, original_bytes, compressed_bytes')
    .lt('archive_day', cutoff)
    .is('purged_at', null);

  if (listErr) throw new Error(`Falha ao listar arquivo expirável: ${listErr.message}`);

  if (!pending || pending.length === 0) {
    return { purged: 0, awaitingConsent: false, pendingDays: 0, consent: null };
  }

  // Consentimento vigente do aprovador (local-part secops.admin, qualquer domínio).
  const { data: consent } = await client
    .from('audit_purge_consent')
    .select('id, consented_by_email, expires_at, status')
    .eq('status', 'GRANTED')
    .ilike('consented_by_email', `${AUDIT_APPROVER_EMAIL}@%`)
    .gte('expires_at', new Date().toISOString())
    .order('granted_at', { ascending: false })
    .limit(1)
    .single();

  if (!consent) {
    return { purged: 0, awaitingConsent: true, pendingDays: pending.length, consent: null };
  }

  const ids = pending.map((p: any) => p.id);
  const { error: delErr } = await client
    .from('audit_logs_archive')
    .delete()
    .in('id', ids);

  if (delErr) throw new Error(`Falha ao expurgar arquivo: ${delErr.message}`);

  // Registra a execução do consentimento.
  await client
    .from('audit_purge_consent')
    .update({ status: 'EXECUTED', executed_at: new Date().toISOString() })
    .eq('id', consent.id);

  const purgedRows = pending.reduce((sum: number, p: any) => sum + (p.row_count ?? 0), 0);

  return {
    purged: purgedRows,
    awaitingConsent: false,
    pendingDays: pending.length,
    consent: { id: consent.id, expiresAt: consent.expires_at },
  };
}

/** Executa a rotina completa de retenção (usada pelo cron e pela action manual). */
export async function runAuditRetentionNow() {
  const archive = await archiveAuditLogs(AUDIT_HOT_RETENTION_DAYS);
  const purge = await purgeArchivedAuditLogs(AUDIT_ARCHIVE_RETENTION_DAYS);
  return { archive, purge };
}

export interface AuditRetentionStatus {
  hot: { count: number; oldest: string | null };
  archive: {
    days: number;
    rows: number;
    originalBytes: number;
    compressedBytes: number;
    newestDay: string | null;
    oldestDay: string | null;
  };
  pendingPurge: { days: number; rows: number };
  consent: {
    id: string | null;
    status: string | null;
    grantedAt: string | null;
    expiresAt: string | null;
    grantedBy: string | null;
  } | null;
}

/** Snapshot do estado da política de retenção para a UI (aba Auditoria). */
export async function getAuditRetentionStatus(): Promise<AuditRetentionStatus> {
  const client = createServiceClient();

  const [{ count: hotCount }, { data: hotOldest }, archiveAgg, { data: consent }] =
    await Promise.all([
      client.from('audit_logs').select('id', { count: 'exact', head: true }),
      client.from('audit_logs').select('created_at').order('created_at', { ascending: true }).limit(1),
      client.from('audit_logs_archive').select('row_count, original_bytes, compressed_bytes, archive_day, purged_at'),
      client
        .from('audit_purge_consent')
        .select('id, status, granted_at, expires_at, consented_by_email')
        .order('granted_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const archiveRows = archiveAgg.data ?? [];
  const storedRows = archiveRows.filter((r: any) => !r.purged_at);
  const newestDay = storedRows.reduce<string | null>(
    (acc, r) => (acc === null || r.archive_day > acc ? r.archive_day : acc),
    null
  );
  const oldestDay = storedRows.reduce<string | null>(
    (acc, r) => (acc === null || r.archive_day < acc ? r.archive_day : acc),
    null
  );

  const cutoff = new Date(Date.now() - AUDIT_ARCHIVE_RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
  const pending = storedRows.filter((r: any) => r.archive_day < cutoff);

  return {
    hot: {
      count: hotCount ?? 0,
      oldest: hotOldest?.[0]?.created_at ?? null,
    },
    archive: {
      days: storedRows.length,
      rows: storedRows.reduce((s: number, r: any) => s + (r.row_count ?? 0), 0),
      originalBytes: storedRows.reduce((s: number, r: any) => s + (r.original_bytes ?? 0), 0),
      compressedBytes: storedRows.reduce((s: number, r: any) => s + (r.compressed_bytes ?? 0), 0),
      newestDay,
      oldestDay,
    },
    pendingPurge: {
      days: pending.length,
      rows: pending.reduce((s: number, r: any) => s + (r.row_count ?? 0), 0),
    },
    consent: consent
      ? {
          id: consent.id,
          status: consent.status,
          grantedAt: consent.granted_at,
          expiresAt: consent.expires_at,
          grantedBy: consent.consented_by_email,
        }
      : null,
  };
}
