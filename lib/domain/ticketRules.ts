import type { TicketPriority, TicketStatus } from '@/lib/types';

/**
 * CAMADA DE DOMÍNIO — regras de negócio PURAS.
 *
 * Este módulo NÃO importa banco de dados, provedores de e-mail ou qualquer
 * infraestrutura. Toda a lógica de negócio de chamados vive aqui e é testável
 * isoladamente. A camada de infraestrutura (supabase, resend) apenas executa
 * o que este módulo decide.
 */

export const VALID_PRIORITIES: TicketPriority[] = ['baixa', 'media', 'alta', 'critica'];

export const VALID_STATUSES: TicketStatus[] = [
  'aberto',
  'em_andamento',
  'em_revisao',
  'fechado',
  'cancelado',
];

export function isAllowedPriority(priority: string): boolean {
  return VALID_PRIORITIES.includes(priority as TicketPriority);
}

export function isAllowedStatus(status: string): boolean {
  return VALID_STATUSES.includes(status as TicketStatus);
}

/** Normaliza a prioridade recebida do cliente, garantindo valor válido. */
export function normalizePriority(priority: string): TicketPriority {
  return isAllowedPriority(priority) ? (priority as TicketPriority) : 'media';
}

/** Instantâneo de um chamado usado para diffs de atualização (regra pura). */
export interface TicketSnapshot {
  status: string;
  priority: string;
  assigneeId: string | null;
  assigneeName?: string | null;
}

/**
 * Calcula a lista de alterações humanamente legíveis entre dois estados de um
 * chamado. Utilizada nas notificações transacionais.
 */
export function buildTicketChanges(
  previous: TicketSnapshot,
  next: TicketSnapshot
): string[] {
  const changes: string[] = [];

  if (previous.status !== next.status) {
    changes.push(`Status alterado de "${previous.status}" para "${next.status}"`);
  }

  if (previous.priority !== next.priority) {
    changes.push(`Prioridade alterada de "${previous.priority}" para "${next.priority}"`);
  }

  if (previous.assigneeId !== next.assigneeId) {
    changes.push(
      next.assigneeName
        ? `Responsável alterado para ${next.assigneeName}`
        : 'Responsável removido'
    );
  }

  return changes;
}