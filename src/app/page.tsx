'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { createBrowserClientInstance } from '@/lib/supabase-browser';
import Topbar from '@/components/shared/topbar';
import Sidebar from '@/components/shared/sidebar';
import KanbanBoard from '@/components/shared/kanban-board';
import ListView from '@/components/shared/list-view';
import CreateTicketModal from '@/components/shared/create-ticket-modal';
import TicketDetailsDrawer from '@/components/shared/ticket-details-drawer';
import { RefreshCw, LayoutGrid, List } from 'lucide-react';

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const supabase = createBrowserClientInstance();

  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // Layout View States
  const [activeView, setActiveView] = useState<'board' | 'list'>('board');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);

  // Fetch all tickets with assignee info
  const fetchTickets = async (resyncId?: string) => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select('*, assignee:assignee_id (full_name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);

      if (resyncId && data) {
        const found = data.find((t) => t.id === resyncId);
        setSelectedTicket(found || null);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTickets();
    }
  }, [user]);

  // Loading spinner for auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm font-medium">Autenticando sessão...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
      
      {/* 1. TOP BAR */}
      <Topbar onCreateClick={() => setCreateModalOpen(true)} />

      {/* 2. CORE INTERFACE (Split layout Sidebar + Main View) */}
      <div className="flex flex-1 relative overflow-hidden">
        
        {/* LEFT COLLAPSIBLE SIDEBAR */}
        <Sidebar activeView={activeView} onViewChange={(view) => setActiveView(view)} />

        {/* RIGHT MAIN WORKSPACE */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-950/20 relative overflow-hidden">
          
          {/* Workspace Sub Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-900 bg-slate-950/30">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
                <span>Quadro Geral de Chamados</span>
              </h1>
              <p className="text-slate-550 text-xs mt-0.5">
                Mapeamento de riscos e arquitetura de segurança SecOps
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {/* Quick statistics summary */}
              <div className="hidden lg:flex items-center space-x-4 text-xs font-semibold text-slate-500">
                <div>
                  <span className="text-indigo-400 font-bold">{tickets.filter(t => t.status !== 'done').length}</span> Pendentes
                </div>
                <div className="w-1 h-1 rounded-full bg-slate-800" />
                <div>
                  <span className="text-emerald-500 font-bold">{tickets.filter(t => t.status === 'done').length}</span> Concluídos
                </div>
              </div>

              {/* Refresh Trigger */}
              <button
                onClick={() => fetchTickets(selectedTicket?.id)}
                disabled={loadingTickets}
                className="p-2 rounded-lg border border-slate-850 hover:bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                title="Recarregar Chamados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTickets ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Workspace Body */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {loadingTickets && tickets.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">
                <div className="flex flex-col items-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="text-xs">Carregando chamados...</p>
                </div>
              </div>
            ) : tickets.length === 0 ? (
              <div className="h-full max-w-md mx-auto flex flex-col items-center justify-center text-center space-y-5 py-16">
                <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-full text-slate-500">
                  <LayoutGrid className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Nenhum chamado de segurança aberto</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Não existem chamados cadastrados nesta fila. Use o botão criar na barra superior para iniciar um novo chamado e mapear um controle de segurança.
                  </p>
                </div>
              </div>
            ) : activeView === 'board' ? (
              <KanbanBoard
                tickets={tickets}
                onTicketSelect={(t) => setSelectedTicket(t)}
                onRefresh={() => fetchTickets(selectedTicket?.id)}
              />
            ) : (
              <ListView
                tickets={tickets}
                onTicketSelect={(t) => setSelectedTicket(t)}
              />
            )}
          </div>
        </main>
      </div>

      {/* 3. MODALS & SLIDEOUT DRAWER */}
      <CreateTicketModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={() => fetchTickets(selectedTicket?.id)}
      />

      <TicketDetailsDrawer
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdate={() => fetchTickets(selectedTicket?.id)}
      />

    </div>
  );
}
