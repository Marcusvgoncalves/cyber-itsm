"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Ticket, Status } from "@/lib/types";
import { KanbanCard } from "./kanban-card";
import { PlusIcon, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTicket } from "@/app/actions/tickets";

interface KanbanColumnProps {
  status: Status;
  tickets: Ticket[];
  currentUserId: string;
  onTicketMove: (ticketId: string, newStatusId: string) => void;
  onTicketClick: (ticket: Ticket) => void;
  onAddTicket: (statusId: string) => void;
}

export function KanbanColumn({ status, tickets, currentUserId, onTicketMove, onTicketClick, onAddTicket }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (draggedTicketId) {
      onTicketMove(draggedTicketId, status.id);
      setDraggedTicketId(null);
    }
  }, [draggedTicketId, status.id, onTicketMove]);

  const handleDragStart = useCallback((e: React.DragEvent, ticketId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", ticketId);
    setDraggedTicketId(ticketId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTicketId(null);
    setIsDragOver(false);
  }, []);

  return (
    <div
      className={cn(
        "kanban-column flex flex-col bg-gray-50 rounded-lg border border-gray-200 min-h-[500px] max-h-[calc(100vh-300px)] overflow-y-auto",
        isDragOver && "drag-over border-2 border-primary"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <h3 className="font-semibold text-gray-900 text-sm">{status.name}</h3>
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
            {tickets.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddTicket(status.id)}
          className="h-8 w-8 p-0"
          aria-label={`Adicionar chamado em ${status.name}`}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Tickets List */}
      <div className="p-3 space-y-3" role="list" aria-label={`Chamados em ${status.name}`}>
        {tickets.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Nenhum chamado</p>
            <p className="text-xs mt-1">Arraste um chamado para cá ou clique no +</p>
          </div>
        ) : (
          tickets.map((ticket) => (
            <KanbanCard
              key={ticket.id}
              ticket={ticket}
              currentUserId={currentUserId}
              onClick={() => onTicketClick(ticket)}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          ))
        )}
      </div>
    </div>
  );
}