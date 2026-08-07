"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Status, Ticket, User } from "@/lib/types";
import { KanbanColumn } from "./kanban-column";
import { TicketModal } from "./ticket-modal";
import { PlusIcon, RefreshCw, BarChart3, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanDashboard } from "./kanban-dashboard";
import { createTicket, moveTicket, getTickets, getStatuses, getUsers } from "@/app/actions/tickets";
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
  const [statuses, setStatuses] = useState<Status[]>(initialStatuses);
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [newTicketStatusId, setNewTicketStatusId] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [_, startTransition] = useTransition();

  const handleTicketMove = useCallback((ticketId: string, newStatusId: string) => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        await moveTicket(ticketId, newStatusId);
        setTickets(prev => prev.map(t => 
          t.id === ticketId ? { ...t, status: newStatusId as Ticket['status'], updated_at: new Date().toISOString() } : t
        ));
      } catch (error) {
        console.error('Erro ao mover ticket:', error);
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

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

  // Abre o modal de criação quando o sinal externo (ex.: botão "Novo Chamado"
  // do Copiloto) é incrementado.
  const lastHandledSignal = useRef(0);
  useEffect(() => {
    if (openCreateSignal > lastHandledSignal.current && statuses.length > 0) {
      lastHandledSignal.current = openCreateSignal;
      handleAddTicket(statuses[0].id);
    }
  }, [openCreateSignal, statuses, handleAddTicket]);

  const handleTicketCreated = useCallback(async (ticketData: Omit<Ticket, 'id' | 'created_at' | 'updated_at' | 'closed_at' | 'assignee' | 'reporter' | 'comments'>) => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const newTicket = await createTicket({ ...ticketData, reporter_id: currentUser.id });
        setTickets(prev => [newTicket, ...prev]);
        handleCloseModal();
      } catch (error) {
        console.error('Erro ao criar ticket:', error);
      } finally {
        setIsLoading(false);
      }
    });
  }, [currentUser.id, handleCloseModal]);

  const handleTicketUpdated = useCallback(async (ticketId: string, updates: Partial<Ticket>) => {
    startTransition(async () => {
      setIsLoading(true);
      try {
        const updated = await updateTicket(ticketId, updates);
        setTickets(prev => prev.map(t => t.id === ticketId ? updated : t));
        handleCloseModal();
      } catch (error) {
        console.error('Erro ao atualizar ticket:', error);
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
    try {
      const [freshTickets, freshStatuses] = await Promise.all([getTickets(), getStatuses()]);
      setTickets(freshTickets);
      setStatuses(freshStatuses);
    } catch (error) {
      console.error('Erro ao atualizar:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Group tickets by status
  const ticketsByStatus = statuses.reduce((acc, status) => {
    acc[status.id] = tickets.filter(t => t.status === status.id);
    return acc;
  }, {} as Record<string, Ticket[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Quadro Kanban</h2>
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
            <span>Total: {tickets.length} chamados</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDashboard(prev => !prev)}
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
          <Button size="sm" onClick={() => { setNewTicketStatusId(statuses[0]?.id || null); setModalMode('create'); setSelectedTicket(null); }}>
            <PlusIcon className="h-4 w-4 mr-1" />
            Novo Chamado
          </Button>
        </div>
      </div>

      {/* Content Area */}
      {showDashboard ? (
        <div className="flex-1 overflow-y-auto">
          <KanbanDashboard
            tickets={tickets}
            statuses={statuses}
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
          defaultStatusId={newTicketStatusId || statuses[0]?.id}
          currentUser={currentUser}
          onClose={handleCloseModal}
          onSubmit={handleTicketSubmit}
          isLoading={isLoading}
        />
      ) : null}
    </div>
  );
}

// Import updateTicket for the callback
import { updateTicket } from "@/app/actions/tickets";