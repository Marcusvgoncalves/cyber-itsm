"use client";

import { cn } from "@/lib/utils";
import { Ticket, TicketPriority, TYPE_COLORS, TYPE_LABELS, PRIORITY_LABELS, PRIORITY_COLORS } from "@/lib/types";
import { GripVertical, User, Clock, CheckSquare, Layers } from "lucide-react";

interface KanbanCardProps {
  ticket: Ticket;
  currentUserId: string;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, ticketId: string) => void;
  onDragEnd: () => void;
}

export function KanbanCard({ ticket, currentUserId, onClick, onDragStart, onDragEnd }: KanbanCardProps) {
  const typeKey = ticket.type || 'TAREFA';
  const typeStyle = TYPE_COLORS[typeKey] || TYPE_COLORS.TAREFA;
  const typeLabel = TYPE_LABELS[typeKey] || typeKey;

  const totalChecklist = ticket.checklist?.length || 0;
  const completedChecklist = ticket.checklist?.filter((i) => i.completed).length || 0;

  return (
    <article
      className={cn(
        "kanban-card bg-white rounded-lg border border-gray-200 p-3.5 cursor-pointer hover:shadow-md transition-all duration-200 space-y-2",
        "dragging:opacity-50 dragging:shadow-lg"
      )}
      draggable
      onClick={onClick}
      onDragStart={(e) => onDragStart(e, ticket.id)}
      onDragEnd={onDragEnd}
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      role="button"
      aria-label={`${ticket.title}, tipo ${typeLabel}, prioridade ${PRIORITY_LABELS[ticket.priority] || ticket.priority}`}
    >
      {/* Header Row: Type Badge + Priority Dot & Drag Handle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="text-gray-300 hover:text-gray-500" onClick={(e) => e.stopPropagation()}>
            <GripVertical className="h-4 w-4 cursor-grab" />
          </div>
          <span
            className={cn(
              "px-2 py-0.5 text-[10px] font-extrabold uppercase rounded border tracking-wider",
              typeStyle.bg,
              typeStyle.text,
              typeStyle.border
            )}
          >
            {typeLabel}
          </span>
        </div>
        <div
          className={cn("w-2.5 h-2.5 rounded-full shrink-0", PRIORITY_COLORS[ticket.priority])}
          title={`Prioridade: ${PRIORITY_LABELS[ticket.priority] || ticket.priority}`}
        />
      </div>

      {/* Tag/Link do Épico Pai (Para Atividade e Tarefa) */}
      {(typeKey === 'ATIVIDADE' || typeKey === 'TAREFA') && ticket.parentEpic && (
        <div className="flex items-center gap-1 text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 font-medium truncate">
          <Layers className="h-3 w-3 shrink-0 text-purple-600" />
          <span className="truncate">Épico: {ticket.parentEpic.title}</span>
        </div>
      )}

      {/* Ticket ID & Title */}
      <div>
        <p className="text-[10px] text-gray-400 font-mono">SPN-{ticket.id.slice(-6).toUpperCase()}</p>
        <h4 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 mt-0.5">{ticket.title}</h4>
      </div>

      {/* Description preview */}
      {ticket.description && (
        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{ticket.description}</p>
      )}

      {/* Footer Info: Assignee, Checklist Progress, Date */}
      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 gap-2">
        <div className="flex items-center gap-1.5 truncate max-w-[60%]">
          <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="truncate font-medium text-gray-700">{ticket.assignee}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {totalChecklist > 0 && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
              <CheckSquare className="h-3 w-3 text-slate-500" />
              <span>
                {completedChecklist}/{totalChecklist}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <Clock className="h-3 w-3" />
            <time dateTime={ticket.updated_at}>
              {new Date(ticket.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </time>
          </div>
        </div>
      </div>
    </article>
  );
}