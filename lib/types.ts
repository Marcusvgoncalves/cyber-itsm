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

export type TicketType = 'EPICO' | 'ATIVIDADE' | 'TAREFA';
export type TicketStatus = 'ABERTO' | 'EM_ANDAMENTO' | 'BLOQUEADO' | 'FECHADO' | 'CANCELADO';
export type TicketPriority = 'baixa' | 'media' | 'alta' | 'critica';
export type FrameworkOrigem = 'NIST' | 'CIS' | 'SABSA' | 'ISO' | 'LGPD' | 'PCI-DSS';
export type SprintStatus = 'PLANEJADA' | 'ATIVA' | 'CONCLUIDA';
export type NotificationChannel = 'email' | 'in_app' | 'sms';
export type IntegrationProtocol = 'oauth2' | 'saml' | 'scim';

export const FRAMEWORK_OPTIONS: FrameworkOrigem[] = ['NIST', 'CIS', 'SABSA', 'ISO', 'LGPD', 'PCI-DSS'];

export interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  status: SprintStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationSetting {
  id: string;
  event_type: string;
  channel: NotificationChannel;
  enabled: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationConnection {
  id: string;
  name: string;
  protocol: IntegrationProtocol;
  config: Record<string, unknown>;
  is_active: boolean;
  last_status: string | null;
  last_tested_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MtlsConfig {
  id: string;
  enabled: boolean;
  ca_cert: string | null;
  client_cert: string | null;
  client_key: string | null;
  require_client_cert: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export const INTEGRATION_PROTOCOL_LABELS: Record<IntegrationProtocol, string> = {
  oauth2: 'OAuth 2.0',
  saml: 'SAML 2.0',
  scim: 'SCIM 2.0',
};

export const INTEGRATION_PROTOCOL_DESCRIPTIONS: Record<IntegrationProtocol, string> = {
  oauth2: 'Conexões via protocolo OAuth 2.0 / OIDC para integração de identidades.',
  saml: 'Federation via protocolo SAML 2.0 (IdP corporativo).',
  scim: 'Provisionamento de identidades via protocolo SCIM 2.0.',
};

export type EnterpriseToolType = 'jira' | 'servicenow' | 'office365';

export interface EnterpriseTool {
  id: string;
  name: string;
  tool_type: EnterpriseToolType;
  config: Record<string, unknown>;
  is_active: boolean;
  last_status: string | null;
  last_tested_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const ENTERPRISE_TOOL_LABELS: Record<EnterpriseToolType, string> = {
  jira: 'Jira Software',
  servicenow: 'ServiceNow',
  office365: 'Microsoft 365 / Office 365',
};

export const ENTERPRISE_TOOL_DESCRIPTIONS: Record<EnterpriseToolType, string> = {
  jira: 'Gestão de demandas e quadros ágeis da Atlassian.',
  servicenow: 'Plataforma de Service Management e ITSM.',
  office365: 'M365 e Microsoft Graph (identidades, e-mail, arquivos).',
};

export interface SecurityRequirement {
  id: string;
  controle: string;
  detalhamento: string | null;
  componente: string | null;
  propriedade: string | null;
  stride_lm: string | null;
  riscos: string | null;
  owasp: string | null;
  categoria: string | null;
  criticidade: string;
  tipo_controle: string | null;
  evidencia: string | null;
  como_testar: string | null;
  custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  title: string;
  description: string | null;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: string; // Nome ou E-mail do Responsável (Obrigatório)
  parentEpicId?: string | null;
  parent_epic_id?: string | null;
  parentEpic?: { id: string; title: string } | null;
  childTickets?: Ticket[];
  framework_origem?: FrameworkOrigem | null;
  dominio_framework?: string | null;
  assignee_id?: string | null;
  reporter_id?: string;
  tags?: string[];
  compliance_frameworks?: string[];
  attachmentName?: string | null;
  attachmentUrl?: string | null;
  dueDate?: string | null;
  sprintId?: string | null;
  sprint?: Sprint | null;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  assignee_user?: User | null;
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
  ABERTO: 'bg-blue-500 text-white',
  EM_ANDAMENTO: 'bg-amber-500 text-white',
  BLOQUEADO: 'bg-red-500 text-white',
  FECHADO: 'bg-emerald-600 text-white',
  CANCELADO: 'bg-slate-500 text-white',
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

export const TYPE_LABELS: Record<TicketType, string> = {
  EPICO: 'Épico',
  ATIVIDADE: 'Atividade',
  TAREFA: 'Tarefa',
};

export const TYPE_COLORS: Record<TicketType, { bg: string; text: string; border: string }> = {
  EPICO: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  ATIVIDADE: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  TAREFA: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  ABERTO: 'Aberto',
  EM_ANDAMENTO: 'Em Andamento',
  BLOQUEADO: 'Bloqueado',
  FECHADO: 'Fechado',
  CANCELADO: 'Cancelado',
};

export const DEFAULT_STATUSES: Status[] = [
  { id: 'ABERTO', name: 'Aberto', color: '#3b82f6', position: 1, is_default: true, created_at: '', updated_at: '' },
  { id: 'EM_ANDAMENTO', name: 'Em Andamento', color: '#f59e0b', position: 2, is_default: false, created_at: '', updated_at: '' },
  { id: 'BLOQUEADO', name: 'Bloqueado', color: '#ef4444', position: 3, is_default: false, created_at: '', updated_at: '' },
  { id: 'FECHADO', name: 'Fechado', color: '#10b981', position: 4, is_default: false, created_at: '', updated_at: '' },
  { id: 'CANCELADO', name: 'Cancelado', color: '#64748b', position: 5, is_default: false, created_at: '', updated_at: '' },
];

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

export const SPRINT_STATUS_LABELS: Record<SprintStatus, string> = {
  PLANEJADA: 'Planejada',
  ATIVA: 'Ativa',
  CONCLUIDA: 'Concluída',
};

export const SPRINT_STATUS_COLORS: Record<SprintStatus, string> = {
  PLANEJADA: 'bg-blue-50 text-blue-700 border-blue-200',
  ATIVA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CONCLUIDA: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const NOTIFICATION_EVENT_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'ticket_created', label: 'Chamado Criado', description: 'Notificação por e-mail quando um novo chamado é criado' },
  { value: 'ticket_updated', label: 'Chamado Atualizado', description: 'Notificação por e-mail quando um chamado é atualizado' },
  { value: 'due_date', label: 'Vencimento (Due Date)', description: 'Alerta por e-mail de proximidade/estouro da data de vencimento (due date)' },
  { value: 'sprint_start', label: 'Início de Sprint', description: 'Notificação por e-mail quando uma sprint entra em execução' },
];

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'E-mail',
  in_app: 'In-App',
  sms: 'SMS',
};