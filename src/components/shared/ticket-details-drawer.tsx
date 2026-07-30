'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClientInstance } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { X, Calendar, User, ShieldAlert, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import { Profile } from '@/lib/auth-context';

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
}

interface TicketDetailsDrawerProps {
  ticket: Ticket | null;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TicketDetailsDrawer({ ticket, onClose, onUpdate }: TicketDetailsDrawerProps) {
  const supabase = createBrowserClientInstance();

  const [analysts, setAnalysts] = useState<Profile[]>([]);
  const [loadingAnalysts, setLoadingAnalysts] = useState(false);

  // Editable fields state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Ticket['status']>('todo');
  const [priority, setPriority] = useState<Ticket['priority']>('medium');
  const [assigneeId, setAssigneeId] = useState('');

  const [saving, setSaving] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);

  // Sync state with selected ticket
  useEffect(() => {
    if (ticket) {
      setTitle(ticket.title);
      setDescription(ticket.description || '');
      setStatus(ticket.status);
      setPriority(ticket.priority);
      setAssigneeId(ticket.assignee_id || '');
      setIsEditingText(false);
    }
  }, [ticket]);

  // Fetch analysts list
  useEffect(() => {
    const fetchAnalysts = async () => {
      setLoadingAnalysts(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['admin', 'analyst']);
        if (!error && data) {
          setAnalysts(data);
        }
      } catch (err) {
        console.error('Error fetching analysts:', err);
      } finally {
        setLoadingAnalysts(false);
      }
    };

    fetchAnalysts();
  }, []);

  if (!ticket) return null;

  // Auto-save dropdown updates
  const saveDropdownField = async (field: string, val: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ [field]: val || null })
        .eq('id', ticket.id);

      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error('Error updating ticket field:', err);
    } finally {
      setSaving(false);
    }
  };

  // Manual save for text fields
  const handleTextSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ title, description })
        .eq('id', ticket.id);

      if (error) throw error;
      setIsEditingText(false);
      onUpdate();
    } catch (err) {
      console.error('Error updating text fields:', err);
    } finally {
      setSaving(false);
    }
  };

  const priorityLabels = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
    critical: 'Crítica',
  };

  const statusLabels = {
    backlog: 'Backlog',
    todo: 'A Fazer',
    in_progress: 'Em Progresso',
    under_review: 'Sob Revisão',
    done: 'Concluído',
  };

  const frameworkNames: Record<string, string> = {
    nist: 'NIST CSF',
    cis: 'CIS Controls',
    iso: 'ISO 27001',
    sabsa: 'SABSA',
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-black/45 z-30 transition-opacity" onClick={onClose} />

      {/* Slideout Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-slate-900 border-l border-slate-800 z-40 flex flex-col shadow-2xl animate-in slide-in-from-right duration-250 select-none">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 border border-blue-500/20 rounded">
              {ticket.key}
            </span>
            <span className="text-xs text-slate-500 font-medium">Detalhes do Chamado</span>
          </div>

          <div className="flex items-center space-x-2">
            {saving && <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Panel Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-350">
          
          {/* Main Info (Title / Description) */}
          <div className="space-y-4">
            {!isEditingText ? (
              <div className="space-y-3">
                <h2 className="text-xl font-bold text-white leading-snug">{title}</h2>
                <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Descrição
                  </p>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {description || <em className="text-slate-600">Nenhuma descrição inserida.</em>}
                  </p>
                </div>
                <Button
                  onClick={() => setIsEditingText(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-3 h-8 rounded-lg"
                >
                  Editar Descrição / Título
                </Button>
              </div>
            ) : (
              <form onSubmit={handleTextSave} className="space-y-4 p-4 bg-slate-950/30 border border-slate-850 rounded-2xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Título
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 focus:border-blue-500 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Descrição
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 focus:border-blue-500 text-white font-sans resize-y"
                  />
                </div>
                <div className="flex space-x-2 justify-end">
                  <Button
                    type="button"
                    onClick={() => {
                      setTitle(ticket.title);
                      setDescription(ticket.description || '');
                      setIsEditingText(false);
                    }}
                    variant="outline"
                    className="border-slate-800 text-xs px-3 h-8"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 h-8"
                  >
                    Salvar
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Cybersecurity Mappings (Read-only tags) */}
          <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5 border-b border-slate-850 pb-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              <span>Controles de Cibersegurança</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Framework:</span>
                <span className="font-semibold text-slate-200">
                  {frameworkNames[ticket.framework || ''] || ticket.framework || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Categoria:</span>
                <span className="font-semibold text-slate-200">{ticket.framework_category || 'N/A'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block">Subcategoria:</span>
                <span className="font-semibold text-slate-200 leading-normal">{ticket.framework_subcategory || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* System attributes / Side Fields */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-850 pb-2 flex items-center space-x-1.5">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Atributos Gerais</span>
            </h3>

            {/* Status Dropdown */}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs">Status:</span>
              <select
                value={status}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setStatus(val);
                  saveDropdownField('status', val);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {Object.entries(statusLabels).map(([k, label]) => (
                  <option key={k} value={k} className="bg-slate-900">
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Dropdown */}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs">Prioridade:</span>
              <select
                value={priority}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setPriority(val);
                  saveDropdownField('priority', val);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {Object.entries(priorityLabels).map(([k, label]) => (
                  <option key={k} value={k} className="bg-slate-900">
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee Dropdown */}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs">Responsável (Assignee):</span>
              <select
                value={assigneeId}
                onChange={(e) => {
                  const val = e.target.value;
                  setAssigneeId(val);
                  saveDropdownField('assignee_id', val);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px] truncate cursor-pointer"
              >
                <option value="">Não atribuído</option>
                {analysts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-slate-900">
                    {a.full_name || a.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Metadata (Dates / Creator) */}
            <div className="pt-4 border-t border-slate-850 space-y-2 text-xs text-slate-500">
              <div className="flex items-center space-x-2">
                <Calendar className="w-3.5 h-3.5 text-slate-650" />
                <span>Criado em: {new Date(ticket.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-3.5 h-3.5 text-slate-650" />
                <span>Atualizado em: {new Date(ticket.updated_at).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
