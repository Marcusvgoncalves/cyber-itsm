"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { createAuditLog, getCurrentUserProfile } from "./auth";
import type { IamProvider, IamUser, IdentityRequest, User } from "@/lib/types";

export async function getIamProviders(): Promise<IamProvider[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('iam_providers')
    .select('*')
    .order('name', { ascending: true });
  
  if (error) throw error;
  return data || [];
}

export async function getIamUsers(): Promise<IamUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('iam_users')
    .select('*')
    .order('last_sync', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function getIdentityRequests(): Promise<IdentityRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('identity_requests')
    .select(`
      *,
      requester:users_profiles!identity_requests_requester_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function createIdentityRequest(formData: {
  provider_id: string;
  target_user_email: string;
  requested_role: 'admin' | 'analista' | 'solicitante';
  justification: string;
}): Promise<IdentityRequest> {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile();
  if (!profile) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('identity_requests')
    .insert({
      requester_id: profile.id,
      provider_id: formData.provider_id,
      target_user_email: formData.target_user_email,
      requested_role: formData.requested_role,
      justification: formData.justification,
      status: 'pendente'
    })
    .select(`
      *,
      requester:users_profiles!identity_requests_requester_id_fkey(id, email, full_name, role, avatar_url)
    `)
    .single();

  if (error) throw error;

  await createAuditLog(
    'identity_request_create',
    'identity_requests',
    data.id,
    null,
    { target_user_email: formData.target_user_email, requested_role: formData.requested_role }
  );

  revalidatePath('/dashboard');
  return data;
}

export async function approveIdentityRequest(requestId: string): Promise<void> {
  const supabase = await createClient();
  const adminProfile = await getCurrentUserProfile();
  if (!adminProfile || adminProfile.role !== 'admin') {
    throw new Error('Permissão negada. Apenas administradores podem aprovar requisições.');
  }

  // 1. Get the request details
  const { data: request, error: getError } = await supabase
    .from('identity_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (getError || !request) throw new Error('Requisição não encontrada.');

  // 2. Start a transaction simulation: Update request + Update user profile role
  // First, find if a user profile exists with this target email
  const { data: targetProfile } = await supabase
    .from('users_profiles')
    .select('id, role')
    .eq('email', request.target_user_email)
    .single();

  if (targetProfile) {
    // Update target user profile role
    const { error: profileUpdateError } = await supabase
      .from('users_profiles')
      .update({ role: request.requested_role })
      .eq('id', targetProfile.id);

    if (profileUpdateError) throw profileUpdateError;
  }

  // Update request status to 'provisionado'
  const { error: requestUpdateError } = await supabase
    .from('identity_requests')
    .update({
      status: 'provisionado',
      approver_id: adminProfile.id,
      approved_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (requestUpdateError) throw requestUpdateError;

  // Log in Audit Logs
  await createAuditLog(
    'identity_request_approve',
    'identity_requests',
    requestId,
    { status: 'pendente' },
    { status: 'provisionado', approver_id: adminProfile.id }
  );

  revalidatePath('/dashboard');
}

export async function rejectIdentityRequest(requestId: string): Promise<void> {
  const supabase = await createClient();
  const adminProfile = await getCurrentUserProfile();
  if (!adminProfile || adminProfile.role !== 'admin') {
    throw new Error('Permissão negada.');
  }

  const { error } = await supabase
    .from('identity_requests')
    .update({
      status: 'rejeitado',
      approver_id: adminProfile.id,
      approved_at: new Date().toISOString()
    })
    .eq('id', requestId);

  if (error) throw error;

  await createAuditLog(
    'identity_request_reject',
    'identity_requests',
    requestId,
    { status: 'pendente' },
    { status: 'rejeitado', approver_id: adminProfile.id }
  );

  revalidatePath('/dashboard');
}

export async function syncIamProvider(providerId: string): Promise<void> {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile();
  if (!profile) throw new Error('Não autenticado');

  // Insert mock users based on provider
  const mockUsers: Omit<IamUser, 'id' | 'created_at' | 'updated_at'>[] = [];
  
  if (providerId === 'entra_id') {
    mockUsers.push(
      {
        provider_id: 'entra_id',
        external_id: 'entra-usr-001',
        email: 'maria.cyber@cyberitsm.local',
        full_name: 'Maria SecOps',
        department: 'CyberSecurity Architecture',
        role: 'analista',
        is_active: true,
        last_sync: new Date().toISOString()
      },
      {
        provider_id: 'entra_id',
        external_id: 'entra-usr-002',
        email: 'carlos.grc@cyberitsm.local',
        full_name: 'Carlos Compliance',
        department: 'Risk and Compliance',
        role: 'solicitante',
        is_active: true,
        last_sync: new Date().toISOString()
      }
    );
  } else if (providerId === 'keycloak') {
    mockUsers.push(
      {
        provider_id: 'keycloak',
        external_id: 'kc-usr-100',
        email: 'jose.admin@cyberitsm.local',
        full_name: 'José Administrador',
        department: 'IT Security',
        role: 'admin',
        is_active: true,
        last_sync: new Date().toISOString()
      }
    );
  }

  // Insert each mock user
  for (const mockUser of mockUsers) {
    const { error } = await supabase
      .from('iam_users')
      .upsert(mockUser, { onConflict: 'provider_id,external_id' });
    if (error) throw error;
  }

  // Record audit log
  await createAuditLog(
    'iam_sync_success',
    'iam_providers',
    providerId,
    null,
    { synced_users_count: mockUsers.length }
  );

  revalidatePath('/dashboard');
}

export async function createLocalUser(formData: {
  email: string;
  full_name: string;
  role: 'admin' | 'analista' | 'solicitante';
}): Promise<User & { temp_password?: string }> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== 'admin') {
    throw new Error('Permissão negada. Apenas administradores podem cadastrar usuários locais.');
  }

  try {
    const rawEmail = formData.email.trim().toLowerCase();
    const targetEmail = rawEmail.includes('@')
      ? rawEmail.replace(/@(telefonica\.com|vivo\.com\.br|.*)$/, '@cyberitsm.local')
      : `${rawEmail}@cyberitsm.local`;

    // 1. Cria o usuário real em auth.users via Admin API (bypass de RLS).
    //    Define a senha padrão de primeiro acesso.
    const defaultPassword = 'CyberITSM@2026!Password';

    const { data: authUser, error: createError } = await admin.auth.admin.createUser({
      email: targetEmail,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        full_name: formData.full_name,
        role: formData.role,
        requires_password_change: true,
      },
      app_metadata: {
        role: formData.role,
      },
    });

    if (createError) {
      const msg = (createError && (createError as any).message) ? (createError as any).message : JSON.stringify(createError);
      if ((createError as any).code === 'user_already_exists' || msg.toLowerCase().includes('already')) {
        throw new Error('Usuário já cadastrado.');
      }
      throw new Error(msg);
    }

    if (!authUser || !authUser.user) {
      throw new Error('Falha ao criar o usuário.');
    }

    // 2. Garante a atualização do registro em users_profiles criado pelo trigger on_auth_user_created.
    const userId = authUser.user.id;
    const { data: upserted, error: upsertError } = await supabase
      .from('users_profiles')
      .upsert({
        id: userId,
        email: targetEmail,
        full_name: formData.full_name,
        role: formData.role,
        mfa_secret: null,
        mfa_setup_complete: false,
      })
      .select('*')
      .single();

    if (upsertError) {
      const msg = (upsertError && (upsertError as any).message) ? (upsertError as any).message : JSON.stringify(upsertError);
      throw new Error(msg);
    }

    await createAuditLog(
      'local_user_create',
      'users_profiles',
      userId,
      null,
      { email: targetEmail, role: formData.role }
    );

    revalidatePath('/dashboard');
    const baseUser = (upserted as User) || { id: userId, email: targetEmail, full_name: formData.full_name, role: formData.role, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), avatar_url: null };
    console.warn(`[IAM] Usuário local criado: ${targetEmail} (id=${userId}). Senha padrão definida.`);
    return { ...baseUser, temp_password: defaultPassword };
  } catch (err) {
    // Log full error server-side and rethrow a sanitized Error (plain string) to avoid
    // Next/React serialization issues that produce minified errors in production.
    console.error('[IAM] createLocalUser error:', err);
    if (err instanceof Error) {
      throw new Error(err.message);
    }
    try {
      throw new Error(JSON.stringify(err));
    } catch {
      throw new Error('Erro desconhecido ao criar usuário.');
    }
  }
}

/**
 * Lista todos os usuários do sistema (perfis). Útil para a gestão de acessos.
 */
export async function listSystemUsers(): Promise<User[]> {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== 'admin') {
    throw new Error('Permissão negada. Apenas administradores podem listar usuários.');
  }

  const { data, error } = await supabase
    .from('users_profiles')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) throw error;
  return (data || []) as User[];
}

/**
 * Atualiza a role (perfil RBAC) de um usuário.
 */
export async function updateUserRole(userId: string, role: 'admin' | 'analista' | 'solicitante'): Promise<void> {
  const supabase = await createClient();
  const admin = createAdminClient();
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== 'admin') {
    throw new Error('Permissão negada. Apenas administradores podem alterar perfis.');
  }
  if (userId === profile.id && role !== 'admin') {
    throw new Error('Você não pode remover o próprio papel de administrador.');
  }

  const { error } = await supabase
    .from('users_profiles')
    .update({ role })
    .eq('id', userId);
  if (error) throw error;

  // Mantém metadata do auth sincronizada.
  await admin.auth.admin.updateUserById(userId, { app_metadata: { role } });

  await createAuditLog('user_role_update', 'users_profiles', userId, null, { role });
  revalidatePath('/dashboard');
}

/**
 * Ativa/desativa o acesso de um usuário (ban/soft-delete lógico).
 */
export async function setUserActive(userId: string, active: boolean): Promise<void> {
  const admin = createAdminClient();
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== 'admin') {
    throw new Error('Permissão negada. Apenas administradores podem alterar o status de acesso.');
  }
  if (userId === profile.id && !active) {
    throw new Error('Você não pode desativar a própria conta.');
  }

  await admin.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' });

  await createAuditLog('user_active_update', 'users_profiles', userId, null, { active });
  revalidatePath('/dashboard');
}

/**
 * Força o usuário a reconfigurar o MFA no próximo login, invalidando a
 * verificação atual (remove o cookie mfa_verified) e limpando o secret.
 */
export async function forceMfaReconfiguration(userId: string): Promise<void> {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== 'admin') {
    throw new Error('Permissão negada. Apenas administradores podem reconfigurar MFA.');
  }

  const { error } = await supabase
    .from('users_profiles')
    .update({ mfa_secret: null, mfa_setup_complete: false })
    .eq('id', userId);

  if (error) throw error;

  await createAuditLog('mfa_force_reset', 'users_profiles', userId, null, { mfa_setup_complete: false });
  revalidatePath('/dashboard');
}
