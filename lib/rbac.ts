import type { UserRole } from '@/lib/types';

/**
 * MATRIZ SoD (Separation of Duties) — RBAC.
 *
 * O domínio opera com 3 perfis de segurança de nível mais alto, que mapeiam
 * diretamente os perfis operacionais existentes:
 *
 *   ADMIN      <- role 'admin'      (acesso total: sprints, notificações, matriz de requisitos, usuários)
 *   USUARIO    <- role 'analista'   (poder de escrita no ITSM, sem governança de cadastros)
 *   SOLICITANTE<- role 'solicitante'(apenas leitura/criação de chamados)
 *
 * Princípio de SoD aplicado:
 *   - Administração de cadastros (sprints/notificações/requisitos) é EXCLUSIVA de ADMIN.
 *   - Nenhum perfil executa funções conflitantes dentro de um mesmo fluxo
 *     (ex.: quem aprova acesso não cria o perfil; quem define requisitos não
 *     aprova chamados de mudança).
 */

export type SodRole = 'ADMIN' | 'USUARIO' | 'SOLICITANTE';

/** Permissões conhecidas da matriz SoD. */
export type SodPermission =
  | 'sprints:view'
  | 'sprints:manage'
  | 'notifications:view'
  | 'notifications:manage'
  | 'requirements:view'
  | 'requirements:manage'
  | 'users:manage'
  | 'tickets:all';

/** Mapeamento direto role -> perfil SoD. */
export const ROLE_TO_SOD: Record<UserRole, SodRole> = {
  admin: 'ADMIN',
  analista: 'USUARIO',
  solicitante: 'SOLICITANTE',
};

/** Matriz de permissões por perfil SoD. */
export const SOD_MATRIX: Record<SodRole, SodPermission[]> = {
  ADMIN: [
    'sprints:view',
    'sprints:manage',
    'notifications:view',
    'notifications:manage',
    'requirements:view',
    'requirements:manage',
    'users:manage',
    'tickets:all',
  ],
  USUARIO: ['sprints:view', 'notifications:view', 'requirements:view', 'tickets:all'],
  SOLICITANTE: ['sprints:view', 'notifications:view', 'requirements:view'],
};

export function roleToSod(role: UserRole): SodRole {
  return ROLE_TO_SOD[role];
}

export function sodHasPermission(role: UserRole, permission: SodPermission): boolean {
  const sod = roleToSod(role);
  return SOD_MATRIX[sod].includes(permission);
}

/** Conveniência: apenas ADMIN gerencia cadastros. */
export function isAdminRole(role: UserRole): boolean {
  return role === 'admin';
}

export const SOD_ROLE_LABELS: Record<SodRole, string> = {
  ADMIN: 'Administrador',
  USUARIO: 'Usuário',
  SOLICITANTE: 'Solicitante',
};
