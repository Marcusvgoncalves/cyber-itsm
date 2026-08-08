import type { TicketPriority, TicketStatus, TicketType } from '@/lib/types';

/**
 * CAMADA DE DOMÍNIO — regras de negócio PURAS.
 *
 * Toda a lógica de negócio de chamados, validações de transição de estado e
 * guardrails hierárquicos (Épicos/Atividades/Tarefas) vivem neste módulo.
 */

export const VALID_PRIORITIES: TicketPriority[] = ['baixa', 'media', 'alta', 'critica'];

export const VALID_TYPES: TicketType[] = ['EPICO', 'ATIVIDADE', 'TAREFA'];

export const VALID_STATUSES: TicketStatus[] = [
  'ABERTO',
  'EM_ANDAMENTO',
  'BLOQUEADO',
  'FECHADO',
  'CANCELADO',
];

/**
 * Matriz de Transição Permitida de Status (Máquina de Estados de Status):
 * - ABERTO -> ['EM_ANDAMENTO', 'CANCELADO']
 * - EM_ANDAMENTO -> ['FECHADO', 'BLOQUEADO', 'CANCELADO']
 * - BLOQUEADO -> ['EM_ANDAMENTO', 'CANCELADO']
 * - FECHADO -> ['ABERTO', 'EM_ANDAMENTO'] (Regra de Reabertura)
 * - CANCELADO -> [] (Estado terminal)
 */
export const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  ABERTO: ['EM_ANDAMENTO', 'CANCELADO'],
  EM_ANDAMENTO: ['FECHADO', 'BLOQUEADO', 'CANCELADO'],
  BLOQUEADO: ['EM_ANDAMENTO', 'CANCELADO'],
  FECHADO: ['ABERTO', 'EM_ANDAMENTO'],
  CANCELADO: [],
};

export function isAllowedPriority(priority: string): boolean {
  return VALID_PRIORITIES.includes(priority as TicketPriority);
}

export function isAllowedStatus(status: string): boolean {
  return VALID_STATUSES.includes(status as TicketStatus);
}

export function isAllowedType(type: string): boolean {
  return VALID_TYPES.includes(type as TicketType);
}

export function normalizePriority(priority: string): TicketPriority {
  return isAllowedPriority(priority) ? (priority as TicketPriority) : 'media';
}

/** Verifica se a transição entre dois status é permitida pela máquina de estados. */
export function isAllowedTransition(fromStatus: TicketStatus, toStatus: TicketStatus): boolean {
  if (fromStatus === toStatus) return true;
  const allowedNext = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowedNext.includes(toStatus);
}

/**
 * Validação de Criação de Chamado:
 * - Status inicial deve ser 'ABERTO'
 * - 'assignee' (Responsável) é obrigatório
 * - 'type' é obrigatório (EPICO, ATIVIDADE, TAREFA)
 * - Se 'type' for ATIVIDADE ou TAREFA, 'parentEpicId' é obrigatório
 */
export function validateTicketCreation(data: {
  type?: string;
  status?: string;
  assignee?: string;
  parentEpicId?: string | null;
}): { valid: boolean; error?: string } {
  if (!data.type || !isAllowedType(data.type)) {
    return { valid: false, error: 'O tipo do chamado (Épico, Atividade ou Tarefa) é obrigatório.' };
  }

  if (data.status && data.status !== 'ABERTO') {
    return { valid: false, error: 'Todo chamado deve nascer obrigatoriamente com o status ABERTO.' };
  }

  if (!data.assignee || !data.assignee.trim()) {
    return { valid: false, error: 'O preenchimento do campo "Responsável" (assignee) é obrigatório.' };
  }

  const type = data.type as TicketType;
  if ((type === 'ATIVIDADE' || type === 'TAREFA') && (!data.parentEpicId || !data.parentEpicId.trim())) {
    return { valid: false, error: 'Chamados do tipo Atividade ou Tarefa exigem obrigatoriamente o vínculo a um Épico Pai.' };
  }

  return { valid: true };
}

/**
 * Validação de Atualização de Chamado:
 * - Imutabilidade do tipo: 'type' não pode ser alterado após a criação
 * - Respeitar a máquina de estados para alteração de status
 */
export function validateTicketUpdate(
  existing: { type: TicketType; status: TicketStatus },
  updates: { type?: string; status?: string }
): { valid: boolean; error?: string } {
  if (updates.type && updates.type !== existing.type) {
    return { valid: false, error: 'Uma vez criado o chamado, o seu Tipo não pode ser alterado sob nenhuma hipótese.' };
  }

  if (updates.status && updates.status !== existing.status) {
    const toStatus = updates.status as TicketStatus;
    if (!isAllowedTransition(existing.status, toStatus)) {
      const allowed = ALLOWED_TRANSITIONS[existing.status] || [];
      const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'Nenhuma (estado terminal)';
      return {
        valid: false,
        error: `Transição de status inválida: De "${existing.status}" só é possível ir para [${allowedStr}].`,
      };
    }
  }

  return { valid: true };
}

/**
 * Guardrail de Dependência de Fechamento de Épico:
 * - Um Épico SÓ PODE ter seu status alterado para 'FECHADO' se TODAS as suas
 *   Atividades e Tarefas filhas estiverem 'FECHADO' ou 'CANCELADO'.
 */
export function canCloseEpic(childTickets: { status: TicketStatus }[]): { allowed: boolean; reason?: string } {
  const pendingChildren = childTickets.filter(
    (c) => c.status !== 'FECHADO' && c.status !== 'CANCELADO'
  );

  if (pendingChildren.length > 0) {
    return {
      allowed: false,
      reason: `Um Épico só pode ser alterado para FECHADO se todas as suas Atividades e Tarefas filhas estiverem com status FECHADO ou CANCELADO. Existem ${pendingChildren.length} item(ns) filho(s) em aberto.`,
    };
  }

  return { allowed: true };
}

export interface TicketSnapshot {
  status: string;
  priority: string;
  assigneeId: string | null;
  assigneeName?: string | null;
}

export function buildTicketChanges(previous: TicketSnapshot, next: TicketSnapshot): string[] {
  const changes: string[] = [];

  if (previous.status !== next.status) {
    changes.push(`Status alterado de "${previous.status}" para "${next.status}"`);
  }

  if (previous.priority !== next.priority) {
    changes.push(`Prioridade alterada de "${previous.priority}" para "${next.priority}"`);
  }

  if (previous.assigneeId !== next.assigneeId) {
    changes.push(
      next.assigneeName ? `Responsável alterado para ${next.assigneeName}` : 'Responsável alterado'
    );
  }

  return changes;
}