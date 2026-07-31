'use client';

import React, { useState } from 'react';
import { Columns, List, Key, Shield, ChevronLeft, ChevronRight, Info, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface SidebarProps {
  activeView: 'board' | 'list' | 'kb';
  onViewChange: (view: 'board' | 'list' | 'kb') => void;
}

export default function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`h-[calc(100vh-3.5rem)] bg-slate-950 border-r border-slate-900/60 relative flex flex-col justify-between select-none transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Upper Area */}
      <div className="flex-1 py-6 flex flex-col">
        {/* Project Header */}
        <div className={`px-4 mb-6 flex items-center ${collapsed ? 'justify-center' : 'space-x-3'}`}>
          <div className="w-8 h-8 rounded-lg bg-indigo-650 flex items-center justify-center font-bold text-white shadow-md shadow-indigo-650/10">
            <Shield className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="text-xs font-bold text-white truncate leading-tight">SecOps Desk</h2>
              <span className="text-[10px] text-slate-500 font-medium leading-none block mt-0.5">
                Arquitetura de Segurança
              </span>
            </div>
          )}
        </div>

        {/* View Selection Menu */}
        <div className="px-2 space-y-1.5 flex-1">
          <button
            onClick={() => onViewChange('board')}
            className={`w-full flex items-center ${
              collapsed ? 'justify-center' : 'space-x-3 px-3'
            } py-2 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'board'
                ? 'bg-slate-900 text-blue-400'
                : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
            }`}
            title="Quadro Kanban"
          >
            <Columns className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Quadro Kanban</span>}
          </button>

          <button
            onClick={() => onViewChange('list')}
            className={`w-full flex items-center ${
              collapsed ? 'justify-center' : 'space-x-3 px-3'
            } py-2 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'list'
                ? 'bg-slate-900 text-blue-400'
                : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
            }`}
            title="Todos os Chamados"
          >
            <List className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Lista de Chamados</span>}
          </button>

          <button
            onClick={() => onViewChange('kb')}
            className={`w-full flex items-center ${
              collapsed ? 'justify-center' : 'space-x-3 px-3'
            } py-2 text-xs font-semibold rounded-lg transition-all ${
              activeView === 'kb'
                ? 'bg-slate-900 text-blue-400'
                : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
            }`}
            title="Base de Conhecimento"
          >
            <BookOpen className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Base de Conhecimento</span>}
          </button>

          <Link
            href="/mfa"
            className={`w-full flex items-center ${
              collapsed ? 'justify-center' : 'space-x-3 px-3'
            } py-2 text-xs font-semibold rounded-lg text-slate-400 hover:bg-slate-900/40 hover:text-slate-200 transition-all`}
            title="Configurar MFA"
          >
            <Key className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Segurança e MFA</span>}
          </Link>
        </div>
      </div>

      {/* Info Warning */}
      {!collapsed && (
        <div className="mx-4 my-4 p-3 bg-slate-900/30 border border-slate-900 rounded-xl flex items-start space-x-2">
          <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-slate-500 leading-normal">
            Geração automática de chaves baseada em SQL sequencial.
          </p>
        </div>
      )}

      {/* Collapse Toggle Trigger */}
      <div className="p-3 border-t border-slate-900/60 flex items-center justify-end">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-lg border border-slate-850 hover:bg-slate-900 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>
    </aside>
  );
}
