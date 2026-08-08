"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Status, Ticket, TicketStatus, User, DEFAULT_STATUSES, Sprint } from "@/lib/types";
import { KanbanColumn } from "./kanban-column";
import { TicketModal } from "./ticket-modal";
import { PlusIcon, RefreshCw, BarChart3, LayoutGrid, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanDashboard } from "./kanban-dashboard";
import { EpicQaModal } from "./epic-qa-modal";
import { createTicket, moveTicket, updateTicket, getTickets, getStatuses } from "@/app/actions/tickets";
import { getSprints } from "@/app/actions/cadastros";
import { isAllowedTransition, ALLOWED_TRANSITIONS, canCloseEpic } from "@/lib/domain/ticketRules";
import { useTransition } from "react";

interface KanbanBoardProps {
  initialStatuses: Status[];
  initialTickets: Ticket[];
  currentUser: User;
  onTicketSelect?: (ticket: Ticket) => void;
  /** Sinal externo (monótono) que abre o modal "Novo Chamado" quando muda. */
  openCreateSignal?: number;
}

export function KanbanBoard({ initialStatuses, initialTickets, currentUser, onTicketSelect, openCreateSignal = 0 }: KanbanBoardProps) {
  const [statuses, setStatuses] = useState<Status[]>(
    initialStatuses.length > 0 ? initialStatuses : DEFAULT_STATUSES
  );
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('edit');
  const [newTicketStatusId, setNewTicketStatusId] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [qaTicket, setQaTicket] = useState<Ticket | null>(null);
  const [, startTransition] = useTransition();

  const handleTicketMove = useCallback((ticketId: string, newStatusId: string) => {
    setValidationError(null);
    const targetStatus = newStatusId.toUpperCase() as TicketStatus;
    const ticketToMove = tickets.find((t) => t.id === ticketId);

    if (ticketToMove) {
      const currentStatus = ticketToMove.status;
      
      // Validação de Transição de Estado
      if (!isAllowedTransition(currentStatus, targetStatus)) {
        const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
        const allowedStr = allowed.length > 0 ? allowed.join(', ') : 'Nenhuma (estado terminal)';
        setValidationError(
          `Movimento bloqueado! De "${currentStatus}" só é permitido ir para: [${allowedStr}].`
        );
        return;
      }

      // Guardrail de Fechamento de Épico
      if (ticketToMove.type === 'EPICO' && targetStatus === 'FECHADO') {
        const childTickets = tickets.filter(
          (t) => t.parentEpicId === ticketId || t.parent_epic_id === ticketId
        );
        const epicGuardrail = canCloseEpic(childTickets);
        if (!epicGuardrail.allowed) {
          setValidationError(`Movimento bloqueado! ${epicGuardrail.reason}`);
          return;
        }
      }
    }

    startTransition(async () => {
      setIsLoading(true);
      try {
        await moveTicket(ticketId, targetStatus);
        setTickets((prev) =>
          prev.map((t) =>
            t.id === ticketId ? { ...t, status: targetStatus, updated_at: new Date().toISOString() } : t
          )
        );
      } catch (error: any) {
        console.error('Erro ao mover ticket:', error);
        setValidationError(error.message || 'Erro ao mover chamado.');
      } finally {
        setIsLoading(false);
      }
    });
  }, [tickets]);

  const handleTicketClick = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket);
    setModalMode('edit');
    onTicketSelect?.(ticket);
  }, [onTicketSelect]);

  const handleCloseModal = useCallback(() => {
    setSelectedTicket(null);
    setNewTicketStatusId(null);
    setModalMode('edit');
  }, []);

  const handleAddTicket = useCallback((statusId: string) => {
    setNewTicketStatusId(statusId);
    setSelectedTicket(null);
    setModalMode('create');
  }, []);

  const lastHandledSignal = useRef(0);
  useEffect(() => {
    if (openCreateSignal > lastHandledSignal.current && statuses.length > 0) {
      lastHandledSignal.current = openCreateSignal;
      handleAddTicket(statuses[0].id);
    }
  }, [openCreateSignal, statuses, handleAddTicket]);

  const handleTicketCreated = useCallback(async (ticketData: any) => {
    setValidationError(null);
    startTransition(async () => {
      setIsLoading(true);
      try {
        const result = await createTicket({ ...ticketData, reporter_id: currentUser.id });
        if ('error' in result) {
          setValidationError(result.error);
          return;
        }
        setTickets((prev) => [result, ...prev]);
        handleCloseModal();
      } catch (error: any) {
        console.error('Erro ao criar ticket:', error);
        setValidationError(error.message || 'Erro ao criar chamado.');
      } finally {
        setIsLoading(false);
      }
    });
  }, [currentUser.id, handleCloseModal]);

  const handleTicketUpdated = useCallback(async (ticketId: string, updates: Partial<Ticket>) => {
    setValidationError(null);
    startTransition(async () => {
      setIsLoading(true);
      try {
        const result = await updateTicket(ticketId, updates);
        if ('error' in result) {
          setValidationError(result.error);
          return;
        }
        setTickets((prev) => prev.map((t) => (t.id === ticketId ? result : t)));
        handleCloseModal();
      } catch (error: any) {
        console.error('Erro ao atualizar ticket:', error);
        setValidationError(error.message || 'Erro ao atualizar chamado.');
      } finally {
        setIsLoading(false);
      }
    });
  }, [handleCloseModal]);

  const handleTicketSubmit = useCallback((data: any) => {
    if (modalMode === 'create') {
      handleTicketCreated(data);
    } else if (modalMode === 'edit' && selectedTicket) {
      handleTicketUpdated(selectedTicket.id, data);
    }
  }, [modalMode, selectedTicket, handleTicketCreated, handleTicketUpdated]);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setValidationError(null);
    try {
      const [freshTickets, freshStatuses, freshSprints] = await Promise.all([
        getTickets(),
        getStatuses(),
        getSprints().catch(() => [] as Sprint[]),
      ]);
      setTickets(freshTickets);
      setStatuses(freshStatuses.length > 0 ? freshStatuses : DEFAULT_STATUSES);
      setSprints(freshSprints);
    } catch (error: any) {
      console.error('Erro ao atualizar:', error);
      setValidationError(error.message || 'Erro ao atualizar lista.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carrega as sprints na montagem para o filtro do Analytics e o modal QA.
  useEffect(() => {
    getSprints().then(setSprints).catch(() => setSprints([]));
  }, []);

  const ticketsByStatus = statuses.reduce((acc, status) => {
    acc[status.id] = tickets.filter((t) => t.status === status.id);
    return acc;
  }, {} as Record<string, Ticket[]>);

  const handleQaTicket = useCallback((ticket: Ticket) => {
    setQaTicket(ticket);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Quadro Kanban Hierárquico</h2>
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
            <span>Total: {tickets.length} chamados</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDashboard((prev) => !prev)}
            className="gap-1.5"
          >
            {showDashboard ? (
              <>
                <LayoutGrid className="h-4 w-4" />
                Visualizar Quadro
              </>
            ) : (
              <>
                <BarChart3 className="h-4 w-4" />
                Dashboard Metrics
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="gap-1"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => { setNewTicketStatusId(statuses[0]?.id || 'ABERTO'); setModalMode('create'); setSelectedTicket(null); }}>
            <PlusIcon className="h-4 w-4 mr-1" />
            Novo Chamado
          </Button>
        </div>
      </div>

      {/* Alerta Visual de Regra de Negócio / Erro de Validação */}
      {validationError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-center justify-between text-xs text-red-800 font-semibold animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{validationError}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setValidationError(null)} className="h-6 w-6 p-0 text-red-600 hover:text-red-900">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Content Area */}
      {showDashboard ? (
        <div className="flex-1 overflow-y-auto">
          <KanbanDashboard
            tickets={tickets}
            statuses={statuses}
            sprints={sprints}
            onClose={() => setShowDashboard(false)}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <div className="flex gap-4 min-w-max pb-4" role="list" aria-label="Colunas do Kanban">
            {statuses.map((status) => (
              <div key={status.id} style={{ minWidth: '300px', maxWidth: '340px' }} role="listitem">
                <KanbanColumn
                  status={status}
                  tickets={ticketsByStatus[status.id] || []}
                  currentUserId={currentUser.id}
                  onTicketMove={handleTicketMove}
                  onTicketClick={handleTicketClick}
                  onAddTicket={handleAddTicket}
                  onQaRequest={handleQaTicket}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ticket Modal */}
      {selectedTicket || modalMode === 'create' ? (
        <TicketModal
          ticket={selectedTicket}
          mode={modalMode}
          statuses={statuses}
          defaultStatusId={newTicketStatusId || statuses[0]?.id || 'ABERTO'}
          currentUser={currentUser}
          allTickets={tickets}
          onClose={handleCloseModal}
          onSubmit={handleTicketSubmit}
          isLoading={isLoading}
        />
      ) : null}

      {/* Modal de Teste de Segurança de Épicos */}
      {qaTicket && (
        <EpicQaModal
          ticket={qaTicket}
          sprints={sprints}
          onClose={() => setQaTicket(null)}
        />
      )}
    </div>
  );
}