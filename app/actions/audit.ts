"use server";

import { getAuthService } from "@/lib/auth/authService";
import { revalidatePath } from "next/cache";
import {
  getAuditRetentionStatus,
  grantPurgeConsent,
  revokePurgeConsent,
  runAuditRetentionNow,
  isAuditApprover,
  type AuditRetentionStatus,
} from "@/lib/audit/retention";
import { createAuditLog } from "@/lib/audit/audit";

/**
 * Server Actions da Política de Retenção de Logs de Auditoria.
 *
 * Todas as ações exigem perfil ADMIN. Conceder/revogar o consentimento de
 * expurgo exige, adicionalmente, que o usuário autenticado SEJA o aprovador
 * exclusivo (secops.admin) — o expurgo de logs > 90 dias não pode ser
 * executado sem esse consentimento (enforced no job de retenção).
 */

async function requireAdmin(): Promise<{ ok: true; userId: string; email: string } | { ok: false; error: string }> {
  const context = await getAuthService().getUser();
  if (!context) return { ok: false, error: 'Não autenticado.' };
  if (context.user.role !== 'admin') {
    return { ok: false, error: 'Acesso negado. Apenas usuários ADMIN podem gerenciar a retenção de auditoria.' };
  }
  return { ok: true, userId: context.session.id, email: context.user.email };
}

export async function getAuditRetentionStatusAction(): Promise<{ data?: AuditRetentionStatus; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  try {
    const status = await getAuditRetentionStatus();
    return { data: status };
  } catch (err) {
    console.error('[Audit Retention] Falha ao consultar status:', err);
    return { error: err instanceof Error ? err.message : 'Falha ao consultar o status da retenção.' };
  }
}

export async function grantAuditPurgeConsentAction(): Promise<{ ok?: boolean; error?: string; expiresAt?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  if (!isAuditApprover(auth.email)) {
    return {
      error: 'Acesso negado. Apenas o usuário aprovador (secops.admin) pode conceder o consentimento de expurgo.',
    };
  }

  try {
    const { id, expiresAt } = await grantPurgeConsent(auth.userId, auth.email);
    await createAuditLog('audit_purge_consent_grant', 'audit_purge_consent', id, null, {
      approved_by: auth.email,
      expires_at: expiresAt,
    });
    revalidatePath('/dashboard');
    return { ok: true, expiresAt };
  } catch (err) {
    console.error('[Audit Retention] Falha ao conceder consentimento:', err);
    return { error: err instanceof Error ? err.message : 'Falha ao conceder o consentimento de expurgo.' };
  }
}

export async function revokeAuditPurgeConsentAction(consentId: string): Promise<{ ok?: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  if (!isAuditApprover(auth.email)) {
    return {
      error: 'Acesso negado. Apenas o usuário aprovador (secops.admin) pode revogar o consentimento de expurgo.',
    };
  }

  try {
    await revokePurgeConsent(consentId);
    await createAuditLog('audit_purge_consent_revoke', 'audit_purge_consent', consentId, null, {
      revoked_by: auth.email,
    });
    revalidatePath('/dashboard');
    return { ok: true };
  } catch (err) {
    console.error('[Audit Retention] Falha ao revogar consentimento:', err);
    return { error: err instanceof Error ? err.message : 'Falha ao revogar o consentimento de expurgo.' };
  }
}

export async function runAuditRetentionNowAction(): Promise<{ ok?: boolean; error?: string; result?: unknown }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  try {
    const result = await runAuditRetentionNow();
    await createAuditLog('audit_retention_run', 'audit_logs_archive', null, null, {
      result: result as unknown as Record<string, unknown>,
    });
    revalidatePath('/dashboard');
    return { ok: true, result };
  } catch (err) {
    console.error('[Audit Retention] Falha ao executar rotina de retenção:', err);
    return { error: err instanceof Error ? err.message : 'Falha ao executar a rotina de retenção.' };
  }
}
