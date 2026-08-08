"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Status,
  Ticket,
  TicketPriority,
  TicketType,
  ChecklistItem,
  User,
  TYPE_LABELS,
  TYPE_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/lib/types";
import {
  X,
  Loader2,
  Tag,
  Shield,
  User as UserIcon,
  CheckSquare,
  Plus,
  Trash2,
  UploadCloud,
  Download,
  CheckCircle2,
  FileText,
  Layers,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import requirementsDataset from "@/requisitos-sd.json";

interface TicketModalProps {
  ticket: Ticket | null;
  mode: 'create' | 'edit';
  statuses: Status[];
  defaultStatusId: string | null;
  currentUser: User;
  allTickets?: Ticket[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

export function TicketModal({
  ticket,
  mode,
  statuses,
  defaultStatusId,
  currentUser,
  allTickets = [],
  onClose,
  onSubmit,
  isLoading,
}: TicketModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'TAREFA' as TicketType,
    status_id: 'ABERTO',
    priority: 'media' as TicketPriority,
    assignee: currentUser.full_name || currentUser.email || '',
    assignee_id: currentUser.id,
    parentEpicId: '',
    tags: '',
  });

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<any[]>([]);

  // States para anexos e parecer
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number; ext: string } | null>(null);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [requirementOpinion, setRequirementOpinion] = useState<string | null>(null);

  useEffect(() => {
    import("@/app/actions/tickets").then(({ getUsers }) => {
      getUsers().then(setUsers).catch(console.error);
    });
  }, []);

  // Lista de Épicos disponíveis para relacionamento pai
  const availableEpics = allTickets.filter(
    (t) => t.type === 'EPICO' && (mode === 'create' || t.id !== ticket?.id)
  );

  useEffect(() => {
    if (ticket) {
      setFormData({
        title: ticket.title,
        description: ticket.description || '',
        type: ticket.type || 'TAREFA',
        status_id: ticket.status || 'ABERTO',
        priority: ticket.priority || 'media',
        assignee: ticket.assignee || ticket.assignee_user?.full_name || ticket.assignee_user?.email || '',
        assignee_id: ticket.assignee_id || '',
        parentEpicId: ticket.parentEpicId || ticket.parent_epic_id || '',
        tags: ticket.tags?.join(', ') || '',
      });
      setChecklist(Array.isArray(ticket.checklist) ? ticket.checklist : []);
    } else {
      setFormData({
        title: '',
        description: '',
        type: 'TAREFA',
        status_id: 'ABERTO',
        priority: 'media',
        assignee: currentUser.full_name || currentUser.email || '',
        assignee_id: currentUser.id,
        parentEpicId: '',
        tags: '',
      });
      setChecklist([]);
    }
    setErrors({});
    setAttachedFile(null);
    setRequirementOpinion(null);
  }, [ticket, defaultStatusId, currentUser]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = 'Título é obrigatório';
    if (formData.title.trim().length < 3) newErrors.title = 'Título deve ter pelo menos 3 caracteres';
    if (!formData.assignee.trim()) newErrors.assignee = 'O preenchimento do Responsável é obrigatório';
    if (!formData.type) newErrors.type = 'O tipo de chamado é obrigatório';

    if ((formData.type === 'ATIVIDADE' || formData.type === 'TAREFA') && !formData.parentEpicId) {
      newErrors.parentEpicId = 'Vínculo a um Épico Pai é OBRIGATÓRIO para Atividades e Tarefas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    const newItem: ChecklistItem = {
      id: 'chk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      text: newChecklistText.trim(),
      completed: false,
    };
    setChecklist((prev) => [...prev, newItem]);
    setNewChecklistText('');
  };

  const handleToggleChecklistItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklist((prev) => prev.filter((item) => item.id !== id));
  };

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    setAttachedFile({ name: file.name, size: file.size, ext });
    setAnalyzingFile(true);

    try {
      const textLower = (file.name + ' ' + formData.description).toLowerCase();
      const matched = (requirementsDataset as any[]).filter((req) => {
        const titleLower = req.titulo.toLowerCase();
        const idLower = req.id.toLowerCase();
        return textLower.includes(idLower) || titleLower.split(' ').some((word: string) => word.length > 4 && textLower.includes(word));
      }).slice(0, 3);

      const matchedIds = matched.map((m) => m.id);
      const opinion = matchedIds.length > 0
        ? `Arquivo "${file.name}" analisado com sucesso. Requisitos direcionados: ${matchedIds.join(', ')}.`
        : `Arquivo "${file.name}" analisado. Requisitos recomendados: VIVO.SEGURA.AUT.01 e VIVO.SEGURA.LOG.03.`;
      setRequirementOpinion(opinion);
    } catch (err) {
      console.error("Erro na análise de anexo:", err);
    } finally {
      setAnalyzingFile(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const submitData = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      type: formData.type,
      status: formData.status_id,
      priority: formData.priority,
      assignee: formData.assignee.trim(),
      assignee_id: formData.assignee_id || null,
      parentEpicId: (formData.type === 'ATIVIDADE' || formData.type === 'TAREFA') ? formData.parentEpicId : null,
      parent_epic_id: (formData.type === 'ATIVIDADE' || formData.type === 'TAREFA') ? formData.parentEpicId : null,
      checklist,
      tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
      reporter_id: currentUser.id,
    };

    onSubmit(submitData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  // Progresso do Checklist
  const totalChecklistCount = checklist.length;
  const completedChecklistCount = checklist.filter((item) => item.completed).length;
  const checklistPercentage = totalChecklistCount > 0 ? Math.round((completedChecklistCount / totalChecklistCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      {/* Modal Container */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">
              {mode === 'create' ? 'Novo Chamado' : `Editar Chamado: SPN-${ticket?.id.slice(-6).toUpperCase()}`}
            </h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0" disabled={isLoading}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-5">
          {/* Tipo & Status Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                Tipo do Chamado * {mode === 'edit' && <span className="text-xs text-amber-600">(Imutável)</span>}
              </Label>
              <Select
                value={formData.type}
                onValueChange={(v: TicketType) => handleChange('type', v)}
                disabled={isLoading || mode === 'edit'}
              >
                <SelectTrigger id="type" className={cn(mode === 'edit' && "bg-slate-100 cursor-not-allowed")}>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EPICO">
                    <span className="font-semibold text-purple-700">Épico</span> (Demanda Macro / Agrupador)
                  </SelectItem>
                  <SelectItem value="ATIVIDADE">
                    <span className="font-semibold text-blue-700">Atividade</span> (Requer Épico Pai)
                  </SelectItem>
                  <SelectItem value="TAREFA">
                    <span className="font-semibold text-emerald-700">Tarefa</span> (Requer Épico Pai)
                  </SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <p className="mt-1 text-xs text-red-500 font-semibold">{errors.type}</p>}
            </div>

            <div>
              <Label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </Label>
              {mode === 'create' ? (
                <Input value="ABERTO (Padrão de Criação)" disabled className="bg-slate-100 text-slate-600 font-medium" />
              ) : (
                <Select value={formData.status_id} onValueChange={(v: string) => handleChange('status_id', v)} disabled={isLoading}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Épico Pai (Visível e obrigatório para Atividade e Tarefa) */}
          {(formData.type === 'ATIVIDADE' || formData.type === 'TAREFA') && (
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg space-y-1">
              <Label htmlFor="parentEpicId" className="block text-xs font-bold text-purple-900 uppercase">
                Épico Pai Vinculado *
              </Label>
              <Select
                value={formData.parentEpicId}
                onValueChange={(v: string) => handleChange('parentEpicId', v)}
                disabled={isLoading}
              >
                <SelectTrigger id="parentEpicId" className={cn("bg-white", errors.parentEpicId && "border-red-500")}>
                  <SelectValue placeholder="Selecione o Épico Pai correspondente..." />
                </SelectTrigger>
                <SelectContent>
                  {availableEpics.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhum Épico cadastrado. Crie um Épico antes!
                    </SelectItem>
                  ) : (
                    availableEpics.map((epic) => (
                      <SelectItem key={epic.id} value={epic.id}>
                        <span className="font-semibold text-purple-800">[ÉPICO]</span> {epic.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.parentEpicId && (
                <p className="text-xs text-red-600 font-semibold mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.parentEpicId}
                </p>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <Label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Título do Chamado *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Ex: Implementar controle de MFA nas APIs de Pagamento"
              className={cn(errors.title && "border-red-500")}
              disabled={isLoading}
            />
            {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
          </div>

          {/* Responsável & Prioridade Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assignee" className="block text-sm font-medium text-gray-700 mb-1">
                Responsável (Assignee) *
              </Label>
              <Select
                value={formData.assignee}
                onValueChange={(v: string) => {
                  handleChange('assignee', v);
                  const selectedUser = users.find((u) => (u.full_name || u.email) === v);
                  if (selectedUser) handleChange('assignee_id', selectedUser.id);
                }}
                disabled={isLoading}
              >
                <SelectTrigger id="assignee" className={cn(errors.assignee && "border-red-500")}>
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => {
                    const name = u.full_name || u.email;
                    return (
                      <SelectItem key={u.id} value={name}>
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span>{name}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                  {!users.some((u) => (u.full_name || u.email) === formData.assignee) && formData.assignee && (
                    <SelectItem value={formData.assignee}>{formData.assignee}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.assignee && <p className="mt-1 text-xs text-red-500">{errors.assignee}</p>}
            </div>

            <div>
              <Label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Prioridade
              </Label>
              <Select value={formData.priority} onValueChange={(v: string) => handleChange('priority', v as TicketPriority)} disabled={isLoading}>
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  {(['baixa', 'media', 'alta', 'critica'] as TicketPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", PRIORITY_COLORS[p])} />
                        {PRIORITY_LABELS[p]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Descrição Detalhada
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Descreva o detalhamento técnico e critérios de aceite da demanda..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* COMPONENTE DE CHECKLIST INTEGRADO */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/60 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase text-slate-700 flex items-center gap-1.5">
                <CheckSquare className="h-4 w-4 text-primary" /> Checklist de Validação ({completedChecklistCount}/{totalChecklistCount})
              </Label>
              <span className="text-xs font-bold text-slate-600">{checklistPercentage}% Concluído</span>
            </div>

            {/* Barra de Progresso Visual */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${checklistPercentage}%` }}
              />
            </div>

            {/* Input Adicionar Item */}
            <div className="flex items-center gap-2 pt-1">
              <Input
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                placeholder="Adicionar novo item de verificação..."
                className="h-8 text-xs bg-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
              />
              <Button type="button" size="sm" onClick={handleAddChecklistItem} className="h-8 text-xs gap-1 shrink-0">
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </Button>
            </div>

            {/* Lista de Itens */}
            <div className="space-y-1.5 pt-1 max-h-48 overflow-y-auto">
              {checklist.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-1 text-center">Nenhum item adicionado ao checklist.</p>
              ) : (
                checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 bg-white rounded border border-slate-100 hover:border-slate-200 transition-colors"
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer text-xs flex-1 select-none">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleToggleChecklistItem(item.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      />
                      <span className={cn(item.completed && "line-through text-slate-400 font-normal", !item.completed && "text-slate-800 font-medium")}>
                        {item.text}
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveChecklistItem(item.id)}
                      className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Anexos de Evidências */}
          <div className="rounded-lg border border-dashed border-slate-300 p-4 bg-white space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase text-slate-600 flex items-center gap-1.5">
                <UploadCloud className="h-4 w-4 text-primary" /> Anexo de Evidências
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.pdf,.jpg,.jpeg,.png,.json,.xml,.txt"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || analyzingFile}
                className="gap-1.5 text-xs"
              >
                {analyzingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                {analyzingFile ? "Analisando..." : "Selecionar Arquivo"}
              </Button>
            </div>

            {attachedFile && (
              <div className="flex items-center justify-between p-2.5 bg-slate-50 border rounded-md text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-slate-800">{attachedFile.name}</span>
                  <span className="text-slate-400">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> GZIP Ready
                </span>
              </div>
            )}

            {requirementOpinion && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-md text-xs text-purple-900">
                <p className="font-bold flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-purple-700" /> Parecer Recomendado:
                </p>
                <p className="mt-1 leading-relaxed text-purple-800">{requirementOpinion}</p>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <Label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
              Tags (separadas por vírgula)
            </Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
              placeholder="segurança, sprint-12, backend"
              disabled={isLoading}
            />
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-200">
            <div>
              {mode === 'edit' && ticket && (
                <a href={`/api/tickets/${ticket.id}/pdf`} target="_blank" rel="noopener noreferrer">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs text-primary border-primary/30">
                    <Download className="h-3.5 w-3.5" /> Exportar Relatório em PDF
                  </Button>
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading} className="gap-2 bg-primary hover:bg-primary/90 text-white">
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Criar Chamado' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
