"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getAuthService } from "@/lib/auth/authService";
import { cookies } from "next/headers";
import { verifyTOTP, generateSecret } from "@/lib/totp";
import { revalidatePath } from "next/cache";

// Interface for profile query response
interface ProfileData {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'analista' | 'solicitante';
  avatar_url: string | null;
  mfa_secret: string | null;
  mfa_setup_complete: boolean;
  reset_token: string | null;
  reset_token_expires_at: string | null;
}

/**
 * Helper to write a system audit log.
 */
export async function createAuditLog(
  action: string,
  entityType: string,
  entityId?: string,
  oldData?: Record<string, any> | null,
  newData?: Record<string, any> | null
) {
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
      user_agent: 'NextJS Server Action'
    });
  } catch (err) {
    console.error('Falha ao gravar log de auditoria:', err);
  }
}

/**
 * Get the current logged-in user profile, including MFA configuration.
 */
export async function getCurrentUserProfile(): Promise<ProfileData | null> {
  const context = await getAuthService().getUser();
  if (!context) return null;
  return context.user as ProfileData;
}

/**
 * Autentica o usuário via o serviço de autenticação (Adapter).
 * A página não conhece o provedor concreto.
 */
export async function signInWithCredentials(
  email: string,
  password: string
): Promise<{ error?: string }> {
  return getAuthService().signIn({ email, password });
}

/**
 * Initiate MFA setup by generating a secret base32 key and TOTP URI.
 */
export async function initiateMfa(): Promise<{ secret: string; qrCodeUri: string }> {
  const user = await getCurrentUserProfile();
  if (!user) throw new Error('Não autenticado');

  const secret = generateSecret();
  const qrCodeUri = `otpauth://totp/CyberITSM:${encodeURIComponent(user.email)}?secret=${secret}&issuer=CyberITSM`;
  return { secret, qrCodeUri };
}

/**
 * Confirm and verify the MFA code for the first setup.
 */
export async function confirmMfaSetup(secret: string, code: string): Promise<boolean> {
  const supabase = await createClient();
  const context = await getAuthService().getUser();
  if (!context) throw new Error('Não autenticado');
  const userId = context.session.id;

  const isValid = await verifyTOTP(code, secret);
  if (!isValid) return false;

  const { error } = await supabase
    .from('users_profiles')
    .update({
      mfa_secret: secret,
      mfa_setup_complete: true
    })
    .eq('id', userId);

  if (error) throw new Error(error.message);

  // Set validation cookie
  const cookieStore = await cookies();
  cookieStore.set('mfa_verified', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/'
  });

  await createAuditLog('mfa_setup_confirm', 'users_profiles', userId, null, { mfa_setup_complete: true });
  
  revalidatePath('/dashboard');
  return true;
}

/**
 * Verify MFA code during login.
 */
export async function verifyMfa(code: string): Promise<boolean> {
  const userProfile = await getCurrentUserProfile();
  if (!userProfile || !userProfile.mfa_secret) return false;

  const isValid = await verifyTOTP(code, userProfile.mfa_secret);
  if (!isValid) return false;

  // Set validation cookie
  const cookieStore = await cookies();
  cookieStore.set('mfa_verified', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/'
  });

  await createAuditLog('mfa_verify_success', 'users_profiles', userProfile.id);
  return true;
}

/**
 * Disable Multi-Factor Authentication.
 */
export async function disableMfa(): Promise<void> {
  const supabase = await createClient();
  const context = await getAuthService().getUser();
  if (!context) throw new Error('Não autenticado');
  const userId = context.session.id;

  const { error } = await supabase
    .from('users_profiles')
    .update({
      mfa_secret: null,
      mfa_setup_complete: false
    })
    .eq('id', userId);

  if (error) throw new Error(error.message);

  const cookieStore = await cookies();
  cookieStore.delete('mfa_verified');

  await createAuditLog('mfa_disabled', 'users_profiles', userId);
  revalidatePath('/dashboard');
}

/**
 * Request a password reset link (simulated token).
 */
export async function requestPasswordReset(usernameOrEmail: string): Promise<{ success: boolean; link?: string; error?: string }> {
  const supabase = await createClient();
  const rawInput = usernameOrEmail.trim().toLowerCase();
  const targetEmail = rawInput.includes('@')
    ? rawInput.replace(/@(telefonica\.com|vivo\.com\.br|.*)$/, '@cyberitsm.local')
    : `${rawInput}@cyberitsm.local`;

  // Find user profile by email
  const { data: profile, error: findError } = await supabase
    .from('users_profiles')
    .select('id')
    .eq('email', targetEmail)
    .single();

  if (findError || !profile) {
    return { success: false, error: 'Usuário não cadastrado no sistema.' };
  }

  // Generate a random token
  const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  const { error: updateError } = await supabase
    .from('users_profiles')
    .update({
      reset_token: token,
      reset_token_expires_at: expiresAt
    })
    .eq('id', profile.id);

  if (updateError) {
    return { success: false, error: 'Falha ao gerar link de recuperação.' };
  }

  // In sandbox, we output the recovery link to the user
  const link = `/reset-password?token=${token}`;

  await supabase.from('audit_logs').insert({
    user_id: profile.id,
    action: 'password_reset_request',
    entity_type: 'users_profiles',
    entity_id: profile.id,
    ip_address: '127.0.0.1',
    user_agent: 'NextJS Server Action'
  });

  return { success: true, link };
}

/**
 * Redefine password using a token.
 */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Find profile with valid token
  const { data: profile, error: findError } = await supabase
    .from('users_profiles')
    .select('id, email, reset_token_expires_at')
    .eq('reset_token', token)
    .single();

  if (findError || !profile) {
    return { success: false, error: 'Token de recuperação inválido ou expirado.' };
  }

  // Check expiration
  if (new Date(profile.reset_token_expires_at!) < new Date()) {
    return { success: false, error: 'Token de recuperação expirou.' };
  }

  // Atualiza a senha real no Supabase Auth usando o Admin Client
  const adminClient = createAdminClient();
  const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
    profile.id,
    { password: newPassword }
  );

  if (authUpdateError) {
    return { success: false, error: 'Falha ao atualizar a credencial de login: ' + authUpdateError.message };
  }

  // Limpa o token de redefinição na tabela users_profiles
  const { error: updateError } = await supabase
    .from('users_profiles')
    .update({
      reset_token: null,
      reset_token_expires_at: null
    })
    .eq('id', profile.id);

  if (updateError) {
    return { success: false, error: 'Falha ao salvar a nova senha.' };
  }

  await supabase.from('audit_logs').insert({
    user_id: profile.id,
    action: 'password_reset_success',
    entity_type: 'users_profiles',
    entity_id: profile.id,
    ip_address: '127.0.0.1',
    user_agent: 'NextJS Server Action'
  });

  return { success: true };
}

/**
 * Change password when logged in.
 */
export async function changeUserPassword(password: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error('Erro ao alterar senha:', error.message);
    return false;
  }
  await createAuditLog('password_change', 'users_profiles');
  return true;
}

/**
 * Logs out the user and clears MFA validation.
 */
export async function logoutUser(): Promise<void> {
  await getAuthService().signOut();
  
  const cookieStore = await cookies();
  cookieStore.delete('mfa_verified');
  cookieStore.delete('session_start');
  cookieStore.delete('last_activity');
}
