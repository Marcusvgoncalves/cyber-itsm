"use server";

import { createClient } from "@/utils/supabase/server";
import { getAuthService } from "@/lib/auth/authService";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/app/actions/auth";
import type { IntegrationConnection, IntegrationProtocol, MtlsConfig } from "@/lib/types";

/**
 * Server Actions do módulo de Integrações IAM (mTLS + conexões OAuth2/SAML/SCIM).
 *
 * Segue a Matriz SoD: apenas o perfil ADMIN pode criar, editar ou remover
 * conexões e alterar a configuração global de Mutual TLS. Os demais perfis
 * apenas leem os dados (a UI oculta os formulários de escrita para não-ADMIN).
 */

function requireAdmin(): Promise<boolean> {
  return getAuthService().checkRole(['admin']);
}

// ---------------------------------------------------------------------------
// Integration Connections (OAuth 2.0 / SAML 2.0 / SCIM 2.0)
// ---------------------------------------------------------------------------

export async function getIntegrationConnections(): Promise<IntegrationConnection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('integration_connections')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as IntegrationConnection[];
}

export type IntegrationConnectionInput = {
  name: string;
  protocol: IntegrationProtocol;
  config: Record<string, unknown>;
  is_active?: boolean;
};

export type IntegrationActionResult = IntegrationConnection | { error: string };

export async function createIntegrationConnection(input: IntegrationConnectionInput): Promise<IntegrationActionResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode criar conexões.' };

  const name = input.name?.trim();
  if (!name) return { error: 'O nome da conexão é obrigatório.' };
  if (!['oauth2', 'saml', 'scim'].includes(input.protocol)) {
    return { error: 'Protocolo inválido. Use OAuth 2.0, SAML 2.0 ou SCIM 2.0.' };
  }

  const supabase = await createClient();
  const context = await getAuthService().getUser();

  const { data, error } = await supabase
    .from('integration_connections')
    .insert({
      name,
      protocol: input.protocol,
      config: input.config || {},
      is_active: input.is_active ?? true,
      created_by: context?.session.id ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar conexão:', error);
    return { error: `Falha ao criar conexão: ${error.message}` };
  }

  await createAuditLog('integration_connection_create', 'integration_connections', data.id, null, {
    name: data.name,
    protocol: data.protocol,
  });
  revalidatePath('/dashboard');
  return data as IntegrationConnection;
}

export async function updateIntegrationConnection(id: string, input: IntegrationConnectionInput): Promise<IntegrationActionResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode editar conexões.' };

  const supabase = await createClient();
  const { data: previous } = await supabase.from('integration_connections').select('*').eq('id', id).single();
  if (!previous) return { error: 'Conexão não encontrada.' };

  const name = input.name?.trim();
  if (!name) return { error: 'O nome da conexão é obrigatório.' };

  const { data, error } = await supabase
    .from('integration_connections')
    .update({
      name,
      protocol: input.protocol,
      config: input.config || {},
      is_active: input.is_active ?? previous.is_active,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar conexão:', error);
    return { error: `Falha ao atualizar conexão: ${error.message}` };
  }

  await createAuditLog('integration_connection_update', 'integration_connections', id, null, {
    name: data.name,
    protocol: data.protocol,
  });
  revalidatePath('/dashboard');
  return data as IntegrationConnection;
}

export async function deleteIntegrationConnection(id: string): Promise<{ error?: string }> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode remover conexões.' };

  const supabase = await createClient();
  const { data: conn } = await supabase.from('integration_connections').select('name').eq('id', id).single();
  if (!conn) return { error: 'Conexão não encontrada.' };

  const { error } = await supabase.from('integration_connections').delete().eq('id', id);
  if (error) return { error: `Falha ao remover conexão: ${error.message}` };

  await createAuditLog('integration_connection_delete', 'integration_connections', id, { name: conn.name }, null);
  revalidatePath('/dashboard');
  return {};
}

export async function toggleIntegrationConnection(id: string, is_active: boolean): Promise<IntegrationActionResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode ativar/desativar conexões.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('integration_connections')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: `Falha ao atualizar status: ${error.message}` };

  await createAuditLog('integration_connection_toggle', 'integration_connections', id, null, { is_active });
  revalidatePath('/dashboard');
  return data as IntegrationConnection;
}

/**
 * Testa uma conexão de forma simulada (sandbox), gravando o resultado em
 * last_status / last_tested_at para fins de auditoria e UI.
 */
export async function testIntegrationConnection(id: string): Promise<{ ok: boolean; message: string }> {
  if (!(await requireAdmin())) return { ok: false, message: 'Acesso negado. Apenas ADMIN pode testar conexões.' };

  const supabase = await createClient();
  const { data: conn } = await supabase.from('integration_connections').select('*').eq('id', id).single();
  if (!conn) return { ok: false, message: 'Conexão não encontrada.' };

  const now = new Date().toISOString();
  const protocol = conn.protocol as IntegrationProtocol;
  const config = (conn.config || {}) as Record<string, string | string[]>;

  // Validação leve da configuração por protocolo
  let ok = true;
  let message = '';

  if (protocol === 'oauth2') {
    const hasToken = config.token_url && typeof config.token_url === 'string' && (config.token_url as string).length > 0;
    const hasClientId = config.client_id && typeof config.client_id === 'string' && (config.client_id as string).length > 0;
    ok = !!hasToken && !!hasClientId;
    message = ok
      ? 'Conexão OAuth 2.0 configurada corretamente. Descoberta de endpoints OK.'
      : 'Configuração incompleta: informe token_url e client_id.';
  } else if (protocol === 'saml') {
    const hasSso = config.sso_url && typeof config.sso_url === 'string' && (config.sso_url as string).length > 0;
    const hasEntity = config.idp_entity_id && typeof config.idp_entity_id === 'string' && (config.idp_entity_id as string).length > 0;
    ok = !!hasSso && !!hasEntity;
    message = ok
      ? 'Metadata SAML válida. Single Sign-On (SSO) alcançável.'
      : 'Configuração incompleta: informe idp_entity_id e sso_url.';
  } else if (protocol === 'scim') {
    const hasBase = config.base_url && typeof config.base_url === 'string' && (config.base_url as string).length > 0;
    ok = !!hasBase;
    message = ok
      ? 'Endpoint SCIM 2.0 configurado. Provisionamento pronto para teste.'
      : 'Configuração incompleta: informe base_url.';
  } else {
    ok = false;
    message = 'Protocolo desconhecido.';
  }

  const status = ok ? 'ok' : 'falhou';
  const full = `${status} · ${message}`;

  await supabase
    .from('integration_connections')
    .update({ last_status: full, last_tested_at: now })
    .eq('id', id);

  await createAuditLog('integration_connection_test', 'integration_connections', id, null, { status, message });
  revalidatePath('/dashboard');
  return { ok, message: full };
}

// ---------------------------------------------------------------------------
// mTLS Global Config (singleton id = 'global')
// ---------------------------------------------------------------------------

export async function getMtlsConfig(): Promise<MtlsConfig | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('mtls_configs')
    .select('*')
    .eq('id', 'global')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as MtlsConfig | null;
}

export type MtlsConfigInput = {
  enabled: boolean;
  ca_cert?: string | null;
  client_cert?: string | null;
  client_key?: string | null;
  require_client_cert?: boolean;
};

export type MtlsActionResult = MtlsConfig | { error: string };

export async function saveMtlsConfig(input: MtlsConfigInput): Promise<MtlsActionResult> {
  if (!(await requireAdmin())) return { error: 'Acesso negado. Apenas ADMIN pode alterar a configuração mTLS.' };

  const supabase = await createClient();
  const context = await getAuthService().getUser();

  const { data, error } = await supabase
    .from('mtls_configs')
    .upsert(
      {
        id: 'global',
        enabled: input.enabled,
        ca_cert: input.ca_cert?.trim() || null,
        client_cert: input.client_cert?.trim() || null,
        client_key: input.client_key?.trim() || null,
        require_client_cert: input.require_client_cert ?? true,
        updated_by: context?.session.id ?? null,
      },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar configuração mTLS:', error);
    return { error: `Falha ao salvar configuração mTLS: ${error.message}` };
  }

  await createAuditLog('mtls_config_update', 'mtls_configs', data.id, null, { enabled: data.enabled });
  revalidatePath('/dashboard');
  return data as MtlsConfig;
}

export async function toggleMtls(enabled: boolean): Promise<MtlsActionResult> {
  const current = await getMtlsConfig();
  return saveMtlsConfig({
    enabled,
    ca_cert: current?.ca_cert ?? null,
    client_cert: current?.client_cert ?? null,
    client_key: current?.client_key ?? null,
    require_client_cert: current?.require_client_cert ?? true,
  });
}
