import type { User, UserRole } from '@/lib/types';

/**
 * Contexto de autenticação do domínio.
 *
 * Reúne o perfil do usuário (regra de negócio) e os metadados de sessão do
 * provedor autenticador. `idpProvider`/`idpExternalId` carregam a identidade
 * federada externa (OAuth/SAML), preparada para provisionamento via SCIM.
 */
export interface AuthContext {
  /** Perfil do usuário autenticado no domínio. */
  user: User;
  /** Identidade fornecida pelo provedor de autenticação. */
  session: {
    id: string;
    email: string;
    /** Provedor de identidade externo (ex.: entra_id, keycloak, saml). */
    idpProvider?: string;
    /** Identificador do usuário no IdP externo. */
    idpExternalId?: string;
  };
}

/**
 * Contrato (interface) do serviço de autenticação.
 *
 * A aplicação depende APENAS desta abstração — nunca de um provedor concreto.
 * Cada provedor (Supabase hoje; Entra ID/Keycloak/SAML amanhã) é um Adapter
 * que implementa esta interface, respeitando o Princípio da Inversão de
 * Dependência (SOLID).
 */
export interface AuthService {
  /** Nome lógico do provedor ativo (para diagnóstico/telemetria). */
  readonly providerName: string;

  /** Retorna o usuário autenticado e seu contexto, ou `null` se não logado. */
  getUser(): Promise<AuthContext | null>;

  /** Valida a sessão junto ao provedor (token expirado/revogado etc.). */
  verifySession(): Promise<boolean>;

  /** True se o usuário autenticado possuir pelo menos uma das roles. */
  checkRole(roles: UserRole[]): Promise<boolean>;

  /** True se há uma sessão ativa (não valida perfil). */
  isAuthenticated(): Promise<boolean>;

  /**
   * Autentica com credenciais (login/password) no provedor ativo.
   * Retorna mensagem de erro amigável, ou `undefined` em caso de sucesso.
   */
  signIn(credentials: { email: string; password: string }): Promise<{ error?: string }>;

  /** Encerra a sessão no provedor. */
  signOut(): Promise<void>;
}