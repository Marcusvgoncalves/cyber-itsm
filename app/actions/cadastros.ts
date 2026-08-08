"use server";

import { createClient } from "@/utils/supabase/server";
import { getAuthService } from "@/lib/auth/authService";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/app/actions/auth";
import type {
  NotificationSetting,
  Sprint,
  SprintStatus,
  NotificationChannel,
  SecurityRequirement,
} from "@/lib/types";

/**
 * Server Actions do módulo "Configurações e Cadastros" (/dashboard?tab=cadastros).
 *
 * Segue a Matriz SoD (Separation of Duties): apenas o perfil ADMIN pode criar,
 * editar ou remover Sprints e configurar Notificações. Os demais perfis apenas
 * leem os dados (a UI oculta os formulários de escrita para não-ADMIN).
 */

function requireAdmin(): Promise<boolean> {
  return getAuthService().checkRole(['admin']);
}

// ---------------------------------------------------------------------------
// Sprints
// ---------------------------------------------------------------------------

export async function getSprints(): Promise<Sprint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sprints')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as Sprint[];
}

export type SprintInput = {
  name: string;
  goal?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: SprintStatus;
};

export type SprintActionResult = Sprint | { error: string };

export async function createSprint(input: SprintInput): Promise<SprintActionResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode criar sprints.' };

  const name = input.name?.trim();
  if (!name) return { error: 'O nome da sprint é obrigatório.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sprints')
    .insert({
      name,
      goal: input.goal?.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status: input.status || 'PLANEJADA',
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar sprint:', error);
    return { error: `Falha ao criar sprint: ${error.message}` };
  }

  await createAuditLog('sprint_create', 'sprints', data.id, null, { name: data.name });
  revalidatePath('/dashboard');
  revalidatePath('/admin/cadastros');
  return data as Sprint;
}

export async function updateSprint(id: string, input: SprintInput): Promise<SprintActionResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode editar sprints.' };

  const supabase = await createClient();
  const { data: previous } = await supabase.from('sprints').select('*').eq('id', id).single();
  if (!previous) return { error: 'Sprint não encontrada.' };

  const name = input.name?.trim();
  if (!name) return { error: 'O nome da sprint é obrigatório.' };

  const { data, error } = await supabase
    .from('sprints')
    .update({
      name,
      goal: input.goal?.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      status: input.status || previous.status,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar sprint:', error);
    return { error: `Falha ao atualizar sprint: ${error.message}` };
  }

  await createAuditLog('sprint_update', 'sprints', id, { name: previous.name }, { name: data.name });
  revalidatePath('/dashboard');
  revalidatePath('/admin/cadastros');
  return data as Sprint;
}

export async function deleteSprint(id: string): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode remover sprints.' };

  const supabase = await createClient();
  const { data: sprint } = await supabase.from('sprints').select('name').eq('id', id).single();
  if (!sprint) return { error: 'Sprint não encontrada.' };

  const { error } = await supabase.from('sprints').delete().eq('id', id);
  if (error) return { error: `Falha ao remover sprint: ${error.message}` };

  await createAuditLog('sprint_delete', 'sprints', id, { name: sprint.name }, null);
  revalidatePath('/dashboard');
  revalidatePath('/admin/cadastros');
  return {};
}

// ---------------------------------------------------------------------------
// Notification Settings
// ---------------------------------------------------------------------------

export async function getNotificationSettings(): Promise<NotificationSetting[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .order('event_type', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as NotificationSetting[];
}

export type NotificationSettingInput = {
  event_type: string;
  channel: NotificationChannel;
  enabled: boolean;
  description?: string | null;
};

export async function upsertNotificationSetting(input: NotificationSettingInput): Promise<NotificationSetting | { error: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode configurar notificações.' };

  if (!input.event_type?.trim()) return { error: 'O tipo de evento é obrigatório.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notification_settings')
    .upsert(
      {
        event_type: input.event_type,
        channel: input.channel,
        enabled: input.enabled,
        description: input.description?.trim() || null,
      },
      { onConflict: 'event_type,channel' }
    )
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar configuração de notificação:', error);
    return { error: `Falha ao salvar configuração: ${error.message}` };
  }

  await createAuditLog('notification_setting_update', 'notification_settings', data.id, null, {
    event_type: data.event_type,
    enabled: data.enabled,
  });
  revalidatePath('/dashboard');
  revalidatePath('/admin/cadastros');
  return data as NotificationSetting;
}

export async function toggleNotificationSetting(id: string, enabled: boolean): Promise<NotificationSetting | { error: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode configurar notificações.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notification_settings')
    .update({ enabled })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao alternar notificação:', error);
    return { error: `Falha ao alternar configuração: ${error.message}` };
  }

  await createAuditLog('notification_setting_update', 'notification_settings', id, null, { enabled });
  revalidatePath('/dashboard');
  revalidatePath('/admin/cadastros');
  return data as NotificationSetting;
}

// ---------------------------------------------------------------------------
// Matriz de Requisitos (Requisitos customizados da governança — ADMIN)
// ---------------------------------------------------------------------------

export async function getCustomRequirements(): Promise<SecurityRequirement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('security_requirements')
    .select('*')
    .eq('custom', true)
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as SecurityRequirement[];
}

export type RequirementInput = {
  id: string;
  controle: string;
  detalhamento?: string | null;
  componente?: string | null;
  propriedade?: string | null;
  stride_lm?: string | null;
  riscos?: string | null;
  owasp?: string | null;
  categoria?: string | null;
  criticidade?: string;
  tipo_controle?: string | null;
  evidencia?: string | null;
  como_testar?: string | null;
};

export type RequirementActionResult = SecurityRequirement | { error: string };

export async function upsertRequirement(input: RequirementInput): Promise<RequirementActionResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode gerenciar requisitos.' };

  const id = input.id?.trim();
  if (!id) return { error: 'O ID do requisito é obrigatório (ex: VIVO.SEGURA.X.001).' };
  if (!input.controle?.trim()) return { error: 'O controle é obrigatório.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('security_requirements')
    .upsert(
      {
        id,
        controle: input.controle.trim(),
        detalhamento: input.detalhamento?.trim() || null,
        componente: input.componente?.trim() || null,
        propriedade: input.propriedade?.trim() || null,
        stride_lm: input.stride_lm?.trim() || null,
        riscos: input.riscos?.trim() || null,
        owasp: input.owasp?.trim() || null,
        categoria: input.categoria?.trim() || null,
        criticidade: input.criticidade?.trim() || 'Moderado',
        tipo_controle: input.tipo_controle?.trim() || null,
        evidencia: input.evidencia?.trim() || null,
        como_testar: input.como_testar?.trim() || null,
        custom: true,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar requisito:', error);
    return { error: `Falha ao salvar requisito: ${error.message}` };
  }

  await createAuditLog('requirement_upsert', 'security_requirements', data.id, null, { controle: data.controle });
  revalidatePath('/admin/cadastros');
  return data as SecurityRequirement;
}

export async function deleteRequirement(id: string): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode remover requisitos.' };

  const supabase = await createClient();
  const { error } = await supabase.from('security_requirements').delete().eq('id', id);
  if (error) return { error: `Falha ao remover requisito: ${error.message}` };

  await createAuditLog('requirement_delete', 'security_requirements', id, null, null);
  revalidatePath('/admin/cadastros');
  return {};
}
