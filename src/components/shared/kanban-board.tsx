'use client';

import React from 'react';
import { createBrowserClientInstance } from '@/lib/supabase-browser';
import { Shield, AlertCircle, Play, CheckCircle2, Clock, HelpCircle } from 'lucide-react';

interface Ticket {
  id: string;
  key: string;
  title: string;
  description: string | null;
  status: 'backlog' | 'todo' | 'in_progress' | 'under_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  framework: string | null;
  framework_category: string | null;
  framework_subcategory: string | null;
  assignee_id: string | null;
  requester_id: string | null;
  created_at: string;
  updated_at: string;
  assignee?: { full_name: string | null; email: string };
}

interface KanbanBoardProps {
  tickets: Ticket[];
  onTicketSelect: (ticket: Ticket) => void;
  onRefresh: () => void;
}

const COLUMNS: { id: Ticket['status']; label: string; color: string }[] = [
  { id: 'backlog', label: 'Backlog', color: 'border-t-slate-500 bg-slate-500/5' },
  { id: 'todo', label: 'A Fazer', color: 'border-t-indigo-500 bg-indigo-500/5' },
  { id: 'in_progress', label: 'Em Progresso', color: 'border-t-blue-500 bg-blue-500/5' },
  { id: 'under_review', label: 'Sob Revisão', color: 'border-t-amber-500 bg-amber-500/5' },
  { id: 'done', label: 'Concluído', color: 'border-t-emerald-500 bg-emerald-500/5' },
];

export default function KanbanBoard({ tickets, onTicketSelect, onRefresh }: KanbanBoardProps) {
  const supabase = createBrowserClientInstance();

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: Ticket['status']) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('text/plain');
    if (!ticketId) return;

    // Fast local state update could be done, but we will update Supabase and refresh
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: targetStatus })
        .eq('id', ticketId);

      if (error) throw error;
      onRefresh();
    } catch (err) {
      console.error('Error dragging ticket:', err);
    }
  };

  // Helper styles for priority
  const priorityInfo = {
    low: { label: 'Baixa', color: 'text-slate-400 bg-slate-900 border-slate-800' },
    medium: { label: 'Média', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-550/20' },
    high: { label: 'Alta', color: 'text-orange-400 bg-orange-500/10 border-orange-550/20' },
    critical: { label: 'Crítica', color: 'text-red-400 bg-red-500/10 border-red-550/20 animate-pulse' },
  };

  // Helper styles for frameworks
  const frameworkStyles: Record<string, string> = {
    nist: 'bg-blue-600/10 text-blue-400 border border-blue-500/20',
    cis: 'bg-orange-600/10 text-orange-400 border border-orange-500/20',
    iso: 'bg-purple-600/10 text-purple-400 border border-purple-500/20',
    sabsa: 'bg-emerald-600/10 text-emerald-450 border border-emerald-500/20',
  };

  const frameworkLabels: Record<string, string> = {
    nist: 'NIST',
    cis: 'CIS',
    iso: 'ISO',
    sabsa: 'SABSA',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start select-none">
      {COLUMNS.map((col) => {
        const columnTickets = tickets.filter((t) => t.status === col.id);

        return (
          <div
            key={col.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`rounded-2xl border-t-2 border-slate-900/60 p-3 flex flex-col min-h-[60vh] transition-all duration-200 ${col.color}`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-xs font-bold text-white tracking-wide uppercase">
                {col.label}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-900/80 border border-slate-800 text-slate-400">
                {columnTickets.length}
              </span>
            </div>

            {/* Column Cards */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[70vh] pb-8 pr-0.5 scrollbar-thin">
              {columnTickets.length === 0 ? (
                <div className="border border-dashed border-slate-850 rounded-xl p-6 text-center text-slate-600 text-xs flex items-center justify-center min-h-[100px]">
                  Solte cartões aqui
                </div>
              ) : (
                columnTickets.map((t) => {
                  const prio = priorityInfo[t.priority];
                  const fwTagClass = frameworkStyles[t.framework || ''] || 'bg-slate-900 text-slate-400 border-slate-800';

                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t.id)}
                      onClick={() => onTicketSelect(t)}
                      className="bg-slate-900 border border-slate-850 hover:border-slate-750/70 p-4 rounded-xl cursor-pointer shadow-lg hover:shadow-blue-500/5 active:scale-[0.98] transition-all duration-200"
                    >
                      {/* Ticket Card Header */}
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          {t.key}
                        </span>
                        
                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          {t.framework && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${fwTagClass}`}>
                              {frameworkLabels[t.framework] || t.framework}
                            </span>
                          )}
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${prio.color}`}>
                            {prio.label}
                          </span>
                        </div>
                      </div>

                      {/* Ticket Title */}
                      <h4 className="text-xs font-semibold text-slate-200 leading-normal line-clamp-2">
                        {t.title}
                      </h4>

                      {/* Category metadata */}
                      {(t.framework_category || t.framework_subcategory) && (
                        <div className="mt-3 text-[10px] text-slate-500 leading-normal border-t border-slate-850 pt-2 space-y-1">
                          {t.framework_category && (
                            <div className="truncate">
                              <span className="text-slate-600">Cat:</span> {t.framework_category}
                            </div>
                          )}
                          {t.framework_subcategory && (
                            <div className="truncate">
                              <span className="text-slate-600">Sub:</span> {t.framework_subcategory.replace(/CIS \d+: |Clause \d+\.\d+: /, '')}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Card Footer (Assignee Name) */}
                      <div className="mt-3 pt-2.5 border-t border-slate-850/80 flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-[10px] text-slate-450 min-w-0">
                          <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[9px] text-slate-300 uppercase flex-shrink-0 border border-slate-750">
                            {t.assignee?.full_name ? t.assignee.full_name.substring(0,2).toUpperCase() : 'UA'}
                          </div>
                          <span className="truncate">
                            {t.assignee?.full_name || 'Não atribuído'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
