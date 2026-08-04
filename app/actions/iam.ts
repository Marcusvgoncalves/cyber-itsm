"use server";

import { createClient } from "@/utils/supabase/server";
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
        email: 'maria.cyber@telefonica.com',
        full_name: 'Maria SecOps',
        department: 'CyberSecurity Architecture',
        role: 'analista',
        is_active: true,
        last_sync: new Date().toISOString()
      },
      {
        provider_id: 'entra_id',
        external_id: 'entra-usr-002',
        email: 'carlos.grc@telefonica.com',
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
        email: 'jose.admin@telefonica.com',
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
}): Promise<void> {
  const supabase = await createClient();
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== 'admin') {
    throw new Error('Permissão negada. Apenas administradores podem cadastrar usuários locais.');
  }

  // Since we are mocking / simulating local creation, we insert directly into users_profiles.
  // In production, we'd create the user in auth.users first, then let the trigger create the profile.
  // To allow easy testing, we generate a mock UUID.
  const mockId = crypto.randomUUID();
  const { error } = await supabase
    .from('users_profiles')
    .insert({
      id: mockId,
      email: formData.email,
      full_name: formData.full_name,
      role: formData.role,
      mfa_setup_complete: false
    });

  if (error) throw error;

  await createAuditLog(
    'local_user_create',
    'users_profiles',
    mockId,
    null,
    { email: formData.email, role: formData.role }
  );

  revalidatePath('/dashboard');
}
