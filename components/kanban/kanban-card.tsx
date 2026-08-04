"use client";

import { cn } from "@/lib/utils";
import { Ticket, TicketPriority } from "@/lib/types";
import { PRIORITY_LABELS, PRIORITY_COLORS } from "@/lib/types";
import { GripVertical, Flag, User, Tag, Clock, AlertTriangle } from "lucide-react";

interface KanbanCardProps {
  ticket: Ticket;
  currentUserId: string;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, ticketId: string) => void;
  onDragEnd: () => void;
}

const PRIORITY_ICONS: Record<TicketPriority, React.ReactNode> = {
  baixa: <Flag className="h-3 w-3 text-gray-400" />,
  media: <Flag className="h-3 w-3 text-blue-500" />,
  alta: <Flag className="h-3 w-3 text-orange-500" />,
  critica: <AlertTriangle className="h-3 w-3 text-red-500" />,
};

export function KanbanCard({ ticket, currentUserId, onClick, onDragStart, onDragEnd }: KanbanCardProps) {
  const isAssignee = ticket.assignee_id === currentUserId;
  const isReporter = ticket.reporter_id === currentUserId;

  return (
    <article
      className={cn(
        "kanban-card bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-all duration-200",
        "dragging:opacity-50 dragging:shadow-lg"
      )}
      draggable
      onClick={onClick}
      onDragStart={(e) => onDragStart(e, ticket.id)}
      onDragEnd={onDragEnd}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      role="button"
      aria-label={`${ticket.title}, prioridade ${PRIORITY_LABELS[ticket.priority]}, ${ticket.framework_origem ? `framework ${ticket.framework_origem}` : ''}`}
    >
      {/* Drag handle */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 text-gray-300 hover:text-gray-500" onClick={(e) => e.stopPropagation()}>
          <GripVertical className="h-4 w-4 cursor-grab" />
        </div>
        <div
          className={cn(
            "w-2 h-2 rounded-full flex-shrink-0 mt-1",
            PRIORITY_COLORS[ticket.priority]
          )}
          title={`Prioridade: ${PRIORITY_LABELS[ticket.priority]}`}
        />
      </div>

      {/* Ticket ID & Title */}
      <div className="mb-2">
        <p className="text-xs text-gray-500 font-mono mb-1">SPN-{ticket.id.slice(-6).toUpperCase()}</p>
        <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{ticket.title}</h4>
      </div>

      {/* Description preview */}
      {ticket.description && (
        <p className="text-xs text-gray-600 line-clamp-2 mb-2">{ticket.description}</p>
      )}

      {/* Meta info */}
      <div className="space-y-1.5 text-xs">
        {/* Framework */}
        {ticket.framework_origem && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <Tag className="h-3 w-3 text-gray-400" />
            <span className="font-medium text-gray-700">{ticket.framework_origem}</span>
            {ticket.dominio_framework && (
              <span className="text-gray-400">/ {ticket.dominio_framework}</span>
            )}
          </div>
        )}

        {/* Assignee */}
        {(ticket.assignee || ticket.reporter) && (
          <div className="flex items-center gap-1.5 text-gray-600">
            <User className="h-3 w-3 text-gray-400" />
            <span className="truncate">
              {ticket.assignee ? (
                <>
                  <span className="font-medium text-gray-700">{ticket.assignee.full_name || ticket.assignee.email}</span>
                  {isAssignee && <span className="ml-1 px-1 py-0.5 text-[10px] bg-primary-light text-primary rounded">Você</span>}
                </>
              ) : (
                <span className="font-medium text-gray-700">{ticket.reporter?.full_name || ticket.reporter?.email || ''}</span>
              )}
            </span>
          </div>
        )}

        {/* Updated at */}
        <div className="flex items-center gap-1.5 text-gray-500">
          <Clock className="h-3 w-3" />
          <time dateTime={ticket.updated_at}>
            {new Date(ticket.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </time>
        </div>
      </div>

      {/* Tags */}
      {ticket.tags && ticket.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {ticket.tags.slice(0, 3).map((tag: string) => (
            <span key={tag} className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded">
              {tag}
            </span>
          ))}
          {ticket.tags.length > 3 && (
            <span className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded">
              +{ticket.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </article>
  );
}