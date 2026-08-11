/**
 * ============================================================================
 * DOMÍNIO KANBAN — Camada de serviço (Prisma) para a API v1.
 *
 * Contém a regra de negócio de Épicos e Chamados com acesso DIRETO ao banco
 * via Prisma — primeiro passo da transição "silenciosa" do monólito
 * (Supabase/Server Actions) para a arquitetura de API Gateway/BFF.
 *
 * Convenções herdadas do legado (espelhadas em `lib/mcp/tools.ts`):
 *   - Épico ativo  = type=EPICO e status em (ABERTO, EM_ANDAMENTO, BLOQUEADO);
 *   - Chamado      = type=TAREFA, status=ABERTO, prioridade derivada da
 *     severidade (LOW→baixa, MEDIUM→media, HIGH→alta, CRITICAL→critica);
 *   - Enriquecimento da descrição via Base de Conhecimento (RAG) quando há
 *     `requirement_code`;
 *   - Trilha de auditoria em `audit_logs` via `createAuditLog`.
 *
 * NOTA DE PARIDADE (schema Prisma × Supabase): a tabela `tickets` possui
 * colunas ainda não mapeadas no schema do Prisma (`assignee_id`,
 * `compliance_frameworks`, `dominio_framework`). Enquanto a Feature Flag
 * `USE_MICROSERVICES_API` estiver FALSE o fluxo legado (Server Action) segue
 * como fonte da verdade. Ao ligar a flag, portar essas colunas para o schema
 * Prisma (aditivo, sem `migrate` — as colunas já existem no banco).
 * ============================================================================
 */

import { z } from 'zod';
import { getRequirementByCode, formatRequirement } from '@/lib/mcp/knowledge-base';
import { createAuditLog } from '@/lib/audit/audit';

/** Erro de domínio com status HTTP associado (consumido pelas rotas /api/v1). */
export class ServiceError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
  }
}

export const SEVERITY_ENUM = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Severity = (typeof SEVERITY_ENUM)[number];

/** Mapeia a severidade para a prioridade nativa do Kanban. */
const SEVERITY_TO_PRIORITY: Record<Severity, 'baixa' | 'media' | 'alta' | 'critica'> = {
  LOW: 'baixa',
  MEDIUM: 'media',
  HIGH: 'alta',
  CRITICAL: 'critica',
};

/** Épicos considerados ativos (não fechados nem cancelados). */
const ACTIVE_EPIC_STATUSES = ['ABERTO', 'EM_ANDAMENTO', 'BLOQUEADO'] as const;

export interface ActiveEpic {
  id: string;
  title: string;
  status: string;
}

/** Resolve o client Prisma + enums de forma LAZY (mesmo padrão da camada pgvector). */
async function loadPrisma() {
  const [{ prisma }, { TicketType }] = await Promise.all([
    import('@/lib/security-qa/prisma'),
    import('@/lib/generated/prisma/enums'),
  ]);
  return { prisma, TicketType };
}

/** Lista os Épicos Pai ativos (type = EPICO, status não terminal). */
export async function listActiveEpics(limit = 20): Promise<ActiveEpic[]> {
  const { prisma, TicketType } = await loadPrisma();

  const rows = await prisma.ticket.findMany({
    where: {
      type: TicketType.EPICO,
      status: { in: [...ACTIVE_EPIC_STATUSES] },
    },
    select: { id: true, title: true, status: true },
    orderBy: { title: 'asc' },
    take: Math.max(1, Math.min(100, limit)),
  });

  return rows.map((row) => ({ id: row.id, title: row.title, status: row.status }));
}

/** Busca um único Épico ativo por ID (validação do vínculo na criação). */
export async function getActiveEpicById(epicId: string): Promise<ActiveEpic | null> {
  const { prisma, TicketType } = await loadPrisma();

  const row = await prisma.ticket.findFirst({
    where: {
      id: epicId,
      type: TicketType.EPICO,
      status: { in: [...ACTIVE_EPIC_STATUSES] },
    },
    select: { id: true, title: true, status: true },
  });

  return row ? { id: row.id, title: row.title, status: row.status } : null;
}

export interface CreateTicketInput {
  title: string;
  description?: string | null;
  severity: Severity;
  epicId: string;
  requirementCode?: string | null;
  /** Usuário autenticado (user.id — atribuído ao chamado). */
  userId: string;
  /** Sessão do usuário (session.id — reporter). */
  reporterId: string;
  userFullName?: string | null;
  userEmail?: string | null;
}

export interface CreatedTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  severity: Severity;
  epic: ActiveEpic;
  requirement_code: string | null;
  assignee: string;
  url: string;
}

/**
 * Cria um chamado (TAREFA) vinculado a um Épico ativo.
 * Espelha a regra de negócio do fluxo MCP legado, mas persiste via Prisma.
 */
export async function createTicket(input: CreateTicketInput): Promise<CreatedTicket> {
  // 0) Épico Pai é obrigatório — valida existência e estado ativo ANTES de escrever.
  const epic = await getActiveEpicById(input.epicId);
  if (!epic) {
    throw new ServiceError(
      'O Épico informado não existe ou não está ativo no Kanban. Use a listagem de Épicos para ver as opções disponíveis.',
      404,
    );
  }

  const severity = input.severity;
  const priority = SEVERITY_TO_PRIORITY[severity];

  // 1) Enriquecimento via Base de Conhecimento (RAG) quando há requirement_code.
  let enrichedDescription = input.description?.trim() ?? '';
  let requirementFound = false;

  if (input.requirementCode) {
    const requirement = getRequirementByCode(input.requirementCode);
    if (requirement) {
      requirementFound = true;
      enrichedDescription = [
        enrichedDescription,
        '',
        `Requisito de referência (Base de Conhecimento): ${input.requirementCode}`,
        formatRequirement(requirement),
      ].filter(Boolean).join('\n');
    } else {
      enrichedDescription = `${enrichedDescription}\n\n[Requisito "${input.requirementCode}" não localizado na Base de Conhecimento — tratado como código livre.]`.trim();
    }
  }

  const assignee = input.userFullName?.trim() || input.userEmail || input.reporterId;

  const { prisma, TicketType } = await loadPrisma();

  const ticket = await prisma.ticket.create({
    data: {
      title: input.title.trim(),
      description: enrichedDescription || null,
      type: TicketType.TAREFA,
      status: 'ABERTO',
      priority,
      assignee,
      parentEpicId: epic.id,
      reporterId: input.reporterId,
      tags: ['mcp', 'copiloto', ...(input.requirementCode ? [input.requirementCode] : [])],
      frameworkOrigem: null,
    },
    select: { id: true, title: true, status: true, priority: true },
  });

  // 2) Trilha de auditoria (melhor esforço — nunca derruba a criação).
  await createAuditLog(
    'ticket_create',
    'tickets',
    ticket.id,
    null,
    {
      title: ticket.title,
      description: enrichedDescription || null,
      status: ticket.status,
      priority: ticket.priority,
      type: 'TAREFA',
      epic_id: epic.id,
      severity,
      requirement_code: input.requirementCode ?? null,
      requirement_found: requirementFound,
      assignee,
      framework_origem: null,
      source: 'api/v1',
    },
  );

  return {
    id: ticket.id,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    severity,
    epic: { id: epic.id, title: epic.title, status: epic.status },
    requirement_code: input.requirementCode ?? null,
    assignee,
    url: '/dashboard',
  };
}

export interface ListTicketsQuery {
  limit?: number;
  status?: string;
}

export interface ListedTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  type: string;
  epic: ActiveEpic | null;
}

/** Lista chamados (type = TAREFA) com filtros opcionais. */
export async function listTickets(query: ListTicketsQuery = {}): Promise<ListedTicket[]> {
  const { prisma, TicketType } = await loadPrisma();
  const { limit = 50, status } = query;

  const rows = await prisma.ticket.findMany({
    where: {
      type: TicketType.TAREFA,
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      type: true,
      parentEpicId: true,
      parentEpic: { select: { id: true, title: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.max(1, Math.min(100, limit)),
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    type: row.type,
    epic: row.parentEpic
      ? { id: row.parentEpic.id, title: row.parentEpic.title, status: row.parentEpic.status }
      : null,
  }));
}

/** Schema Zod do payload de criação (espelha o inputSchema da ferramenta MCP). */
export const createTicketSchema = z.object({
  title: z.string().trim().min(3, 'O título do chamado deve ter ao menos 3 caracteres.').max(200),
  description: z.string().trim().max(4000).optional(),
  severity: z.enum(SEVERITY_ENUM),
  epic_id: z.string().uuid('O parâmetro epic_id deve ser um UUID válido.'),
  requirement_code: z.string().trim().max(64).optional(),
});
