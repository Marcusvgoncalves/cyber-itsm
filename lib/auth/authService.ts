import type { AuthService } from './types';
import { SupabaseAuthAdapter } from './supabaseAdapter';

/**
 * Factory do serviço de autenticação (Fábrica + Inversão de Dependência).
 *
 * As páginas e ações chamam apenas `getAuthService()` e usam os métodos
 * genéricos (`getUser()`, `verifySession()`, `checkRole()`, ...). A escolha do
 * Adapter concreto é resolvida aqui por configuração, jamais nas páginas.
 *
 * Onde plugar os IdPs corporativos:
 *   AUTH_PROVIDER=entra_id  ->  novo adapter (OAuth2 / OIDC + SSO)
 *   AUTH_PROVIDER=keycloak  ->  novo adapter (broker OIDC)
 *   AUTH_PROVIDER=saml      ->  novo adapter (SAML 2.0, ex.: ADFS/Oracle)
 *   Provisionamento SCIM: usa a interface para mapear idpExternalId
 *   em `users_profiles` (ver supabase-schema.sql).
 */
const adapterByProvider = (
  provider: string
): AuthService => {
  switch (provider) {
    // Futuros adapters corporativos entram aqui.
    // case 'entra_id': return new EntraIdAuthAdapter();
    // case 'keycloak': return new KeycloakAuthAdapter();
    // case 'saml': return new SamlAuthAdapter();
    default:
      return new SupabaseAuthAdapter();
  }
};

let instance: AuthService | null = null;

export function getAuthService(): AuthService {
  if (!instance) {
    instance = adapterByProvider(process.env.AUTH_PROVIDER ?? 'supabase');
  }
  return instance;
}

export type { AuthService, AuthContext } from './types';
export type { AuthService as AuthProvider } from './types';