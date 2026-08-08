/**
 * Auditoria — escrita de trilha de auditoria para ações do usuário (server-only).
 *
 * Centraliza a gravação em public.audit_logs usando o cliente autenticado (RLS):
 * a policy de INSERT exige auth.uid() = user_id, portanto o contexto do usuário
 * logado é obrigatório. Para ações de sistema (workers/cron) use o service role
 * diretamente (ver lib/audit/retention.ts).
 *
 * Falhas de auditoria NUNCA derrubam a ação principal (try/catch silencioso) —
 * auditoria é "melhor esforço" e não pode virar ponto único de falha.
 */
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getAuthService } from "@/lib/auth/authService";

/**
 * Grava um log de auditoria da ação do usuário autenticado.
 * @param action Nome da ação (ex: 'ticket_delete').
 * @param entityType Tipo da entidade afetada (ex: 'tickets', 'qa_results').
 * @param entityId ID da entidade afetada.
 * @param oldData Estado anterior (para UPDATE/DELETE).
 * @param newData Estado posterior (para CREATE/UPDATE).
 */
export async function createAuditLog(
  action: string,
  entityType: string,
  entityId?: string | null,
  oldData?: Record<string, unknown> | null,
  newData?: Record<string, unknown> | null
): Promise<void> {
  try {
    const supabase = await createClient();
    const context = await getAuthService().getUser();
    if (!context) return;

    await supabase.from('audit_logs').insert({
      user_id: context.session.id,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      old_data: oldData || null,
      new_data: newData || null,
      ip_address: '127.0.0.1', // Mocked or read if available
      user_agent: 'NextJS Server Action',
    });
  } catch (err) {
    console.error('Falha ao gravar log de auditoria:', err);
  }
}

/**
 * Grava um log de auditoria SEM depender da sessão HTTP (service role).
 * Usado para eventos de borda (login/logout) e ações de sistema em que o
 * contexto autenticado ainda não está disponível no mesmo request.
 */
export async function logSystemAudit(
  userId: string | null | undefined,
  action: string,
  entityType: string,
  entityId?: string | null,
  oldData?: Record<string, unknown> | null,
  newData?: Record<string, unknown> | null
): Promise<void> {
  try {
    const client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      }
    );

    await client.from('audit_logs').insert({
      user_id: userId ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      old_data: oldData || null,
      new_data: newData || null,
      ip_address: '127.0.0.1',
      user_agent: 'Auth Service',
    });
  } catch (err) {
    console.error('Falha ao gravar log de auditoria (sistema):', err);
  }
}
