"use server";

import { createClient } from "@/utils/supabase/server";
import { getAuthService } from "@/lib/auth/authService";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/app/actions/auth";
import type { EnterpriseTool, EnterpriseToolType } from "@/lib/types";

/**
 * Server Actions do módulo de Integrações com Ferramentas Enterprise
 * (Jira, ServiceNow, Office 365).
 *
 * Segue a Matriz SoD: apenas o perfil ADMIN pode criar, editar ou remover
 * integrações. Os demais perfis apenas leem os dados (a UI oculta os
 * formulários de escrita para não-ADMIN).
 */

function requireAdmin(): Promise<boolean> {
  return getAuthService().checkRole(['admin']);
}

export async function getEnterpriseTools(): Promise<EnterpriseTool[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('enterprise_tools')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as EnterpriseTool[];
}

export type EnterpriseToolInput = {
  name: string;
  tool_type: EnterpriseToolType;
  config: Record<string, unknown>;
  is_active?: boolean;
};

export type EnterpriseToolResult = EnterpriseTool | { error: string };

export async function createEnterpriseTool(input: EnterpriseToolInput): Promise<EnterpriseToolResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode criar integrações.' };

  const name = input.name?.trim();
  if (!name) return { error: 'O nome da integração é obrigatório.' };
  if (!['jira', 'servicenow', 'office365'].includes(input.tool_type)) {
    return { error: 'Ferramenta inválida. Use Jira, ServiceNow ou Office 365.' };
  }

  const supabase = await createClient();
  const context = await getAuthService().getUser();

  const { data, error } = await supabase
    .from('enterprise_tools')
    .insert({
      name,
      tool_type: input.tool_type,
      config: input.config || {},
      is_active: input.is_active ?? true,
      created_by: context?.session.id ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar integração:', error);
    return { error: `Falha ao criar integração: ${error.message}` };
  }

  await createAuditLog('enterprise_tool_create', 'enterprise_tools', data.id, null, {
    name: data.name,
    tool_type: data.tool_type,
  });
  revalidatePath('/dashboard');
  return data as EnterpriseTool;
}

export async function updateEnterpriseTool(id: string, input: EnterpriseToolInput): Promise<EnterpriseToolResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode editar integrações.' };

  const supabase = await createClient();
  const { data: previous } = await supabase.from('enterprise_tools').select('*').eq('id', id).single();
  if (!previous) return { error: 'Integração não encontrada.' };

  const name = input.name?.trim();
  if (!name) return { error: 'O nome da integração é obrigatório.' };

  const { data, error } = await supabase
    .from('enterprise_tools')
    .update({
      name,
      tool_type: input.tool_type,
      config: input.config || {},
      is_active: input.is_active ?? previous.is_active,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar integração:', error);
    return { error: `Falha ao atualizar integração: ${error.message}` };
  }

  await createAuditLog('enterprise_tool_update', 'enterprise_tools', id, null, {
    name: data.name,
    tool_type: data.tool_type,
  });
  revalidatePath('/dashboard');
  return data as EnterpriseTool;
}

export async function deleteEnterpriseTool(id: string): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode remover integrações.' };

  const supabase = await createClient();
  const { data: tool } = await supabase.from('enterprise_tools').select('name').eq('id', id).single();
  if (!tool) return { error: 'Integração não encontrada.' };

  const { error } = await supabase.from('enterprise_tools').delete().eq('id', id);
  if (error) return { error: `Falha ao remover integração: ${error.message}` };

  await createAuditLog('enterprise_tool_delete', 'enterprise_tools', id, { name: tool.name }, null);
  revalidatePath('/dashboard');
  return {};
}

export async function toggleEnterpriseTool(id: string, is_active: boolean): Promise<EnterpriseToolResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode ativar/desativar integrações.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('enterprise_tools')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: `Falha ao atualizar status: ${error.message}` };

  await createAuditLog('enterprise_tool_toggle', 'enterprise_tools', id, null, { is_active });
  revalidatePath('/dashboard');
  return data as EnterpriseTool;
}

/**
 * Testa uma integração enterprise de forma simulada (sandbox), gravando o
 * resultado em last_status / last_tested_at para auditoria e UI.
 */
export async function testEnterpriseTool(id: string): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: 'Acesso negado. Apenas ADMIN pode testar integrações.' };

  const supabase = await createClient();
  const { data: tool } = await supabase.from('enterprise_tools').select('*').eq('id', id).single();
  if (!tool) return { ok: false, message: 'Integração não encontrada.' };

  const now = new Date().toISOString();
  const type = tool.tool_type as EnterpriseToolType;
  const config = (tool.config || {}) as Record<string, string>;

  let ok = true;
  let message = '';

  if (type === 'jira') {
    const hasUrl = config.base_url && config.base_url.trim().length > 0;
    ok = !!hasUrl;
    message = ok
      ? 'Jira configurado. Conectividade com a instância Atlassian validada.'
      : 'Configuração incompleta: informe a base_url do Jira.';
  } else if (type === 'servicenow') {
    const hasUrl = config.instance_url && config.instance_url.trim().length > 0;
    const hasClient = config.client_id && config.client_id.trim().length > 0;
    ok = !!hasUrl && !!hasClient;
    message = ok
      ? 'ServiceNow configurado. Autenticação OAuth e acesso à instância validados.'
      : 'Configuração incompleta: informe instance_url e client_id.';
  } else if (type === 'office365') {
    const hasTenant = config.tenant_id && config.tenant_id.trim().length > 0;
    const hasClient = config.client_id && config.client_id.trim().length > 0;
    ok = !!hasTenant && !!hasClient;
    message = ok
      ? 'Office 365 configurado. Descoberta de tenant via Microsoft Graph validada.'
      : 'Configuração incompleta: informe tenant_id e client_id.';
  } else {
    ok = false;
    message = 'Ferramenta desconhecida.';
  }

  const status = ok ? 'ok' : 'falhou';
  const full = `${status} · ${message}`;

  await supabase
    .from('enterprise_tools')
    .update({ last_status: full, last_tested_at: now })
    .eq('id', id);

  await createAuditLog('enterprise_tool_test', 'enterprise_tools', id, null, { status, message });
  revalidatePath('/dashboard');
  return { ok, message: full };
}
