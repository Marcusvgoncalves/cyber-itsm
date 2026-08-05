import { createClient } from '@/utils/supabase/server';
import type { User, UserRole } from '@/lib/types';
import type { AuthContext, AuthService } from './types';

/**
 * Adapter do Supabase para o serviço de autenticação.
 *
 * Encapsula todo o conhecimento específico do Supabase Auth (cookies/SSR,
 * colunas de `users_profiles`, metadados de sessão) dentro desta classe.
 * Qualquer troca de provedor (Entra ID, Keycloak, SAML) exige apenas um novo
 * Adapter implementando a mesma interface `AuthService`.
 */
export class SupabaseAuthAdapter implements AuthService {
  readonly providerName = 'supabase';

  async getUser(): Promise<AuthContext | null> {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('users_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return null;

    return {
      user: profile as User,
      session: {
        id: user.id,
        email: user.email ?? profile.email,
        idpProvider: user.app_metadata?.idp_provider as string | undefined,
        idpExternalId: user.app_metadata?.idp_external_id as string | undefined,
      },
    };
  }

  async verifySession(): Promise<boolean> {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return !error && Boolean(user);
  }

  async checkRole(roles: UserRole[]): Promise<boolean> {
    const context = await this.getUser();
    if (!context) return false;
    return roles.includes(context.user.role);
  }

  async isAuthenticated(): Promise<boolean> {
    return this.verifySession();
  }

  async signIn(credentials: {
    email: string;
    password: string;
  }): Promise<{ error?: string }> {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    // Normaliza a mensagem do provedor em uma mensagem amigável ao usuário.
    if (error) {
      return {
        error:
          error.message === 'Invalid login credentials'
            ? 'Credenciais inválidas. Verifique seu e-mail e senha.'
            : error.message,
      };
    }

    return {};
  }

  async signOut(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
}