'use client';

import React, { useEffect, useState } from 'react';
import { createBrowserClientInstance } from '@/lib/supabase-browser';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { 
  X, Calendar, User, ShieldAlert, AlertCircle, RefreshCw, FileText,
  MessageSquare, Paperclip, History, Send, Trash2, Download, UploadCloud
} from 'lucide-react';
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

interface Comment {
  id: string;
  ticket_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: { full_name: string | null; email: string; role: string };
}

interface Attachment {
  id: string;
  ticket_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
  uploader?: { full_name: string | null; email: string };
}

interface AuditLog {
  id: string;
  ticket_id: string;
  user_id: string | null;
  action: string;
  old_values: any;
  new_values: any;
  created_at: string;
  actor?: { full_name: string | null; email: string; role: string };
}

interface TicketDetailsDrawerProps {
  ticket: Ticket | null;
  onClose: () => void;
  onUpdate: () => void;
}

export default function TicketDetailsDrawer({ ticket, onClose, onUpdate }: TicketDetailsDrawerProps) {
  const { user, profile: currentUserProfile } = useAuth();
  const supabase = createBrowserClientInstance();

  const [analysts, setAnalysts] = useState<Profile[]>([]);
  const [loadingAnalysts, setLoadingAnalysts] = useState(false);

  // General Attributes States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Ticket['status']>('todo');
  const [priority, setPriority] = useState<Ticket['priority']>('medium');
  const [assigneeId, setAssigneeId] = useState('');

  const [saving, setSaving] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);

  // Tab Navigation State
  const [activeTab, setActiveTab] = useState<'comments' | 'attachments' | 'history'>('comments');

  // Tab Data States
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Action states
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [loadingTabContent, setLoadingTabContent] = useState(false);

  // Fetch comments
  const fetchComments = async () => {
    if (!ticket) return;
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('*, author:user_id (full_name, email, role)')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setComments(data as any[]);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  // Fetch attachments
  const fetchAttachments = async () => {
    if (!ticket) return;
    try {
      const { data, error } = await supabase
        .from('attachments')
        .select('*, uploader:uploaded_by (full_name, email)')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setAttachments(data as any[]);
      }
    } catch (err) {
      console.error('Error fetching attachments:', err);
    }
  };

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    if (!ticket) return;
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, actor:user_id (full_name, email, role)')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setAuditLogs(data as any[]);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    }
  };

  // Sync state with selected ticket
  useEffect(() => {
    if (ticket) {
      setTitle(ticket.title);
      setDescription(ticket.description || '');
      setStatus(ticket.status);
      setPriority(ticket.priority);
      setAssigneeId(ticket.assignee_id || '');
      setIsEditingText(false);

      // Fetch related data
      setLoadingTabContent(true);
      Promise.all([fetchComments(), fetchAttachments(), fetchAuditLogs()]).finally(() => {
        setLoadingTabContent(false);
      });
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
      await fetchAuditLogs();
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
      await fetchAuditLogs();
    } catch (err) {
      console.error('Error updating text fields:', err);
    } finally {
      setSaving(false);
    }
  };

  // Submit new comment
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    setCommentSubmitting(true);
    try {
      const { error } = await supabase.from('comments').insert({
        ticket_id: ticket.id,
        user_id: user.id,
        content: newComment.trim(),
      });

      if (error) throw error;
      setNewComment('');
      await fetchComments();
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Delete comment
  const handleCommentDelete = async (id: string) => {
    if (!confirm('Deseja excluir este comentário?')) return;
    try {
      const { error } = await supabase.from('comments').delete().eq('id', id);
      if (error) throw error;
      await fetchComments();
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  // Upload file attachment
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingFile(true);
    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${ticket.id}/${Date.now()}_${sanitizedName}`;

      // 1. Upload to Supabase Private Storage Bucket
      const { error: uploadError } = await supabase.storage
        .from('evidence-attachments')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Register metadata row in database
      const { error: dbError } = await supabase.from('attachments').insert({
        ticket_id: ticket.id,
        file_name: file.name,
        file_path: storagePath,
        file_size: file.size,
        uploaded_by: user.id,
      });

      if (dbError) {
        // Cleanup storage file if DB insert fails to maintain integrity
        await supabase.storage.from('evidence-attachments').remove([storagePath]);
        throw dbError;
      }

      await fetchAttachments();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao fazer upload do arquivo.');
    } finally {
      setUploadingFile(false);
      // Reset input value
      e.target.value = '';
    }
  };

  // Secure download via signed URL
  const downloadAttachment = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('evidence-attachments')
        .createSignedUrl(filePath, 60); // Link valid for 60 seconds

      if (error) throw error;
      
      // Open link securely in new tab
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      console.error('Error getting download URL:', err);
      alert('Não foi possível fazer download da evidência com segurança.');
    }
  };

  // Delete attachment
  const handleAttachmentDelete = async (id: string, filePath: string) => {
    if (!confirm('Deseja remover esta evidência? Isso apagará o arquivo permanentemente.')) return;
    try {
      // 1. Delete DB row (cascades or is standalone)
      const { error: dbError } = await supabase.from('attachments').delete().eq('id', id);
      if (dbError) throw dbError;

      // 2. Remove file from Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('evidence-attachments')
        .remove([filePath]);
      if (storageError) console.error('Storage cleanup failed:', storageError);

      await fetchAttachments();
    } catch (err) {
      console.error('Error deleting attachment:', err);
    }
  };

  // Helper parser for audit logs
  const parseAuditLog = (log: AuditLog) => {
    const actorName = log.actor?.full_name || log.actor?.email || 'Sistema';
    const dateStr = new Date(log.created_at).toLocaleString('pt-BR');

    if (log.action === 'INSERT') {
      return `${actorName} criou o chamado.`;
    }

    if (log.action === 'UPDATE') {
      const changes: string[] = [];
      const oldVal = log.old_values || {};
      const newVal = log.new_values || {};

      const fieldsToCheck = [
        { key: 'status', label: 'Status' },
        { key: 'priority', label: 'Prioridade' },
        { key: 'assignee_id', label: 'Responsável' },
        { key: 'title', label: 'Título' },
        { key: 'description', label: 'Descrição' }
      ];

      fieldsToCheck.forEach(({ key, label }) => {
        if (oldVal[key] !== newVal[key]) {
          changes.push(label);
        }
      });

      if (changes.length === 0) return `${actorName} atualizou atributos gerais.`;
      return `${actorName} atualizou [${changes.join(', ')}].`;
    }

    return `${actorName} executou ação de ${log.action}.`;
  };

  const priorityLabels = { low: 'Baixa', medium: 'Média', high: 'Alta', critical: 'Crítica' };
  const statusLabels = { backlog: 'Backlog', todo: 'A Fazer', in_progress: 'Em Progresso', under_review: 'Sob Revisão', done: 'Concluído' };
  const roleColors: Record<string, string> = {
    admin: 'text-red-400 bg-red-500/10 border-red-500/20',
    analyst: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    requester: 'text-emerald-450 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/45 z-30 transition-opacity" onClick={onClose} />

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
            {(saving || uploadingFile) && <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin text-xs text-slate-350">
          
          {/* 1. Title and Description */}
          <div className="space-y-4">
            {!isEditingText ? (
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-white leading-snug">{title}</h2>
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Descrição
                  </p>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {description || <em className="text-slate-600">Nenhuma descrição inserida.</em>}
                  </p>
                </div>
                <Button
                  onClick={() => setIsEditingText(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-white text-[11px] px-3 h-8 rounded-lg"
                >
                  Editar
                </Button>
              </div>
            ) : (
              <form onSubmit={handleTextSave} className="space-y-4 p-4 bg-slate-950/30 border border-slate-850 rounded-2xl">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Título
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 text-white text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-650/40 text-white font-sans text-xs resize-y"
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
                    className="border-slate-800 text-[10px] px-3 h-7"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-3 h-7"
                  >
                    Salvar
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* 2. Attributes dropdowns */}
          <div className="grid grid-cols-2 gap-4 border-t border-slate-850 pt-4">
            <div className="flex flex-col space-y-1">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Status</span>
              <select
                value={status}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setStatus(val);
                  saveDropdownField('status', val);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {Object.entries(statusLabels).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col space-y-1">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Prioridade</span>
              <select
                value={priority}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setPriority(val);
                  saveDropdownField('priority', val);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                {Object.entries(priorityLabels).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2 flex flex-col space-y-1">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Responsável</span>
              <select
                value={assigneeId}
                onChange={(e) => {
                  const val = e.target.value;
                  setAssigneeId(val);
                  saveDropdownField('assignee_id', val);
                }}
                disabled={loadingAnalysts}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Não atribuído</option>
                {analysts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name || a.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Tabbed collaboration sections */}
          <div className="border-t border-slate-850 pt-4 flex flex-col flex-1">
            {/* Tabs Trigger Headers */}
            <div className="flex border-b border-slate-850 mb-4 p-0.5 bg-slate-950/40 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('comments')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center space-x-1.5 transition-all ${
                  activeTab === 'comments' ? 'bg-slate-850 text-white shadow' : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat ({comments.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('attachments')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center space-x-1.5 transition-all ${
                  activeTab === 'attachments' ? 'bg-slate-850 text-white shadow' : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>Evidências ({attachments.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md flex items-center justify-center space-x-1.5 transition-all ${
                  activeTab === 'history' ? 'bg-slate-850 text-white shadow' : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Auditoria</span>
              </button>
            </div>

            {/* Loading indicators for tabs */}
            {loadingTabContent ? (
              <div className="py-8 flex items-center justify-center text-slate-500">
                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mr-2" />
                <span>Carregando dados...</span>
              </div>
            ) : (
              <div>
                {/* 3.1 TAB: COMMENTS */}
                {activeTab === 'comments' && (
                  <div className="space-y-4">
                    {/* Add Comment form */}
                    <form onSubmit={handleCommentSubmit} className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Adicionar um comentário público..."
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-white placeholder-slate-600 text-xs"
                      />
                      <Button
                        type="submit"
                        disabled={commentSubmitting || !newComment.trim()}
                        className="bg-blue-600 hover:bg-blue-500 text-white h-auto py-2 px-3 rounded-xl flex items-center justify-center"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </form>

                    {/* Comments Thread list */}
                    <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-0.5 scrollbar-thin">
                      {comments.length === 0 ? (
                        <p className="text-center text-slate-600 py-6">Nenhum comentário registrado.</p>
                      ) : (
                        comments.map((c) => {
                          const isCommentOwner = user?.id === c.user_id;
                          return (
                            <div key={c.id} className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl flex flex-col space-y-1.5 relative group">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-white text-[11px]">
                                    {c.author?.full_name || c.author?.email?.split('@')[0]}
                                  </span>
                                  {c.author?.role && (
                                    <span className={`text-[9px] px-1.5 rounded font-bold border ${roleColors[c.author.role] || ''}`}>
                                      {c.author.role === 'admin' ? 'Admin' : c.author.role === 'analyst' ? 'Analista' : 'Solicitante'}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-550">
                                  {new Date(c.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <p className="text-slate-350 leading-relaxed whitespace-pre-wrap break-all text-xs">{c.content}</p>
                              
                              {/* Delete option */}
                              {isCommentOwner && (
                                <button
                                  type="button"
                                  onClick={() => handleCommentDelete(c.id)}
                                  className="absolute right-2.5 bottom-2.5 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* 3.2 TAB: EVIDENCE ATTACHMENTS */}
                {activeTab === 'attachments' && (
                  <div className="space-y-4">
                    {/* Upload Field */}
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-800 border-dashed rounded-2xl cursor-pointer bg-slate-950/20 hover:bg-slate-950/40 hover:border-slate-700 transition-all">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <UploadCloud className="w-6 h-6 text-slate-500 mb-1" />
                          <p className="text-[10px] text-slate-500 font-semibold">
                            Clique para anexar evidência/log
                          </p>
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                        />
                      </label>
                    </div>

                    {/* Attachments List */}
                    <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-0.5 scrollbar-thin">
                      {attachments.length === 0 ? (
                        <p className="text-center text-slate-600 py-6">Nenhum arquivo anexado.</p>
                      ) : (
                        attachments.map((a) => {
                          const sizeKb = Math.round(a.file_size / 1024);
                          const isUploader = user?.id === a.uploaded_by;
                          return (
                            <div key={a.id} className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl flex items-center justify-between gap-3 group">
                              <div className="flex items-center space-x-2.5 min-w-0">
                                <div className="p-2 bg-indigo-650/10 border border-indigo-500/20 rounded-lg text-indigo-400 flex-shrink-0">
                                  <Paperclip className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-200 truncate text-[11px]">{a.file_name}</p>
                                  <span className="text-[10px] text-slate-550 block mt-0.5">
                                    {sizeKb} KB • por {a.uploader?.full_name || 'Uploader'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => downloadAttachment(a.file_path, a.file_name)}
                                  className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                  title="Baixar evidência com segurança"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                {(isUploader || currentUserProfile?.role === 'admin') && (
                                  <button
                                    type="button"
                                    onClick={() => handleAttachmentDelete(a.id, a.file_path)}
                                    className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-850 text-slate-550 hover:text-red-400 transition-colors"
                                    title="Remover anexo"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* 3.3 TAB: AUDIT TIMELINE */}
                {activeTab === 'history' && (
                  <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-0.5 scrollbar-thin">
                    {auditLogs.length === 0 ? (
                      <p className="text-center text-slate-600 py-6">Nenhum histórico registrado.</p>
                    ) : (
                      auditLogs.map((log) => (
                        <div key={log.id} className="p-3 bg-slate-950/20 border border-slate-850/60 rounded-xl relative pl-8">
                          {/* Left dot timeline */}
                          <div className="absolute left-3 top-4 w-2 h-2 rounded-full bg-blue-600" />
                          <div className="absolute left-[15px] top-6 bottom-0 w-0.5 bg-slate-800" />
                          
                          <p className="text-slate-300 font-medium text-xs leading-normal">
                            {parseAuditLog(log)}
                          </p>
                          <span className="text-[9px] text-slate-550 block mt-1">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
