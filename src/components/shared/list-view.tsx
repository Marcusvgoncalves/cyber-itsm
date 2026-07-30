'use client';

import React, { useState } from 'react';
import { Search, Filter, ShieldAlert } from 'lucide-react';

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

interface ListViewProps {
  tickets: Ticket[];
  onTicketSelect: (ticket: Ticket) => void;
}

export default function ListView({ tickets, onTicketSelect }: ListViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [frameworkFilter, setFrameworkFilter] = useState<string>('all');

  // Filter logic
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesFramework = frameworkFilter === 'all' || t.framework === frameworkFilter;

    return matchesSearch && matchesStatus && matchesFramework;
  });

  const priorityLabels = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    critical: 'Crítica',
  };

  const priorityColors = {
    low: 'text-slate-400 bg-slate-900 border-slate-800',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
    critical: 'text-red-400 bg-red-500/10 border-red-550/25 font-bold',
  };

  const statusLabels = {
    backlog: 'Backlog',
    todo: 'A Fazer',
    in_progress: 'Em Progresso',
    under_review: 'Sob Revisão',
    done: 'Concluído',
  };

  const statusBadgeColors = {
    backlog: 'bg-slate-800 text-slate-300 border-slate-700',
    todo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    under_review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    done: 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20',
  };

  const frameworkLabels: Record<string, string> = {
    nist: 'NIST CSF',
    cis: 'CIS Controls',
    iso: 'ISO 27001',
    sabsa: 'SABSA',
  };

  return (
    <div className="space-y-4 select-none">
      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/30 border border-slate-900 p-4 rounded-2xl backdrop-blur-xl">
        
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 pointer-events-none">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por ID ou Título..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 text-slate-200 placeholder-slate-655 text-xs transition-all"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex w-full sm:w-auto items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 flex-1 sm:flex-none">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todos Status</option>
              {Object.entries(statusLabels).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Framework Filter */}
          <div className="flex items-center space-x-1.5 flex-1 sm:flex-none">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={frameworkFilter}
              onChange={(e) => setFrameworkFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todos Frameworks</option>
              {Object.entries(frameworkLabels).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Ticket List Table */}
      <div className="border border-slate-900 rounded-2xl bg-slate-900/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/40 text-slate-500 border-b border-slate-900 font-bold uppercase tracking-wider">
                <th className="py-3 px-4 font-bold">Chave</th>
                <th className="py-3 px-4 font-bold">Resumo / Título</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold">Prioridade</th>
                <th className="py-3 px-4 font-bold">Mapeamento de Segurança</th>
                <th className="py-3 px-4 font-bold">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60 text-slate-300">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Nenhum chamado encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onTicketSelect(t)}
                    className="hover:bg-slate-900/40 cursor-pointer transition-colors duration-150"
                  >
                    {/* Key */}
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                      {t.key}
                    </td>
                    
                    {/* Title */}
                    <td className="py-3.5 px-4 font-semibold text-slate-200 truncate max-w-xs md:max-w-md">
                      {t.title}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${statusBadgeColors[t.status]}`}>
                        {statusLabels[t.status]}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold border text-[10px] ${priorityColors[t.priority]}`}>
                        {priorityLabels[t.priority]}
                      </span>
                    </td>

                    {/* Security mapping */}
                    <td className="py-3.5 px-4">
                      {t.framework ? (
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded uppercase">
                            {frameworkLabels[t.framework] || t.framework}
                          </span>
                          <span className="text-slate-500 max-w-[150px] truncate">
                            {t.framework_category}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Assignee */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-750 flex items-center justify-center font-bold text-[9px] text-slate-350 uppercase">
                          {t.assignee?.full_name ? t.assignee.full_name.substring(0, 2).toUpperCase() : 'UA'}
                        </div>
                        <span className="truncate max-w-[120px]">
                          {t.assignee?.full_name || 'Não atribuído'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
