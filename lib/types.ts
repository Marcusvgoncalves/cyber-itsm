export type UserRole = 'admin' | 'analista' | 'solicitante';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  mfa_secret?: string | null;
  mfa_setup_complete?: boolean;
  reset_token?: string | null;
  reset_token_expires_at?: string | null;
  /** Provedor de identidade federado de origem (OAuth/SAML). */
  idp_provider?: string | null;
  /** Identificador do usuário no IdP externo (SCIM/mapping). */
  idp_external_id?: string | null;
  idp_issued_at?: string | null;
  idp_last_sync?: string | null;
  is_active?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Status {
  id: string;
  name: string;
  color: string;
  position: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type TicketStatus = 'aberto' | 'em_andamento' | 'em_revisao' | 'fechado' | 'cancelado';
export type TicketPriority = 'baixa' | 'media' | 'alta' | 'critica';
export type FrameworkOrigem = 'NIST' | 'CIS' | 'SABSA' | 'ISO' | 'LGPD' | 'PCI-DSS';

export const FRAMEWORK_OPTIONS: FrameworkOrigem[] = ['NIST', 'CIS', 'SABSA', 'ISO', 'LGPD', 'PCI-DSS'];

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  framework_origem: FrameworkOrigem | null;
  dominio_framework: string | null;
  assignee_id: string | null;
  reporter_id: string;
  tags?: string[];
  compliance_frameworks?: string[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  assignee?: User | null;
  reporter?: User;
  comments?: Comment[];
}

export interface Comment {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: User;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: User;
}

export interface IamProvider {
  id: string;
  name: string;
  type: 'entra_id' | 'keycloak' | 'oam' | 'sailpoint' | 'local';
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IamUser {
  id: string;
  provider_id: string;
  external_id: string;
  email: string;
  full_name: string | null;
  department: string | null;
  role: UserRole | null;
  is_active: boolean;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdentityRequest {
  id: string;
  requester_id: string;
  provider_id: string;
  target_user_email: string;
  requested_role: UserRole;
  justification: string;
  status: 'pendente' | 'aprovado' | 'rejeitado' | 'provisionado';
  approver_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  requester?: User;
}

export const STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-status-backlog',
  todo: 'bg-status-todo',
  progress: 'bg-status-progress',
  review: 'bg-status-review',
  done: 'bg-status-done',
};

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  baixa: 'bg-priority-low',
  media: 'bg-priority-medium',
  alta: 'bg-priority-high',
  critica: 'bg-priority-critical',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em Andamento',
  em_revisao: 'Em Revisão',
  fechado: 'Fechado',
  cancelado: 'Cancelado',
};

export const FRAMEWORK_LABELS: Record<FrameworkOrigem, string> = {
  NIST: 'NIST CSF',
  CIS: 'CIS Controls',
  SABSA: 'SABSA',
  ISO: 'ISO 27001',
  LGPD: 'LGPD',
  'PCI-DSS': 'PCI-DSS',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  analista: 'Analista',
  solicitante: 'Solicitante',
};

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  analista: ['tickets:read', 'tickets:write', 'tickets:assign', 'status:read', 'comments:write'],
  solicitante: ['tickets:read', 'tickets:create', 'comments:write'],
};