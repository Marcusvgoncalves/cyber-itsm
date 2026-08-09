"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Status,
  Ticket,
  TicketPriority,
  TicketType,
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
  UploadCloud,
  Download,
  CheckCircle2,
  FileText,
  Layers,
  AlertCircle,
  CircleHelp,
  Search,
  Trash2,
  ArrowLeft,
  Check,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";

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
  /** Exclusão exclusiva de ADMIN (Matriz SoD). */
  canDelete?: boolean;
  onDelete?: (ticket: Ticket) => void;
}

/** VPs disponíveis para o multi-select de tags (ordem alfabética). */
const VP_OPTIONS = [
  "CEO",
  "COO",
  "VP B2B",
  "VP B2C",
  "VP Canais Digitais",
  "VP CFO",
  "VP Comunicação",
  "VP Engenharia",
  "VP Estratégia/Regulatório/CSO",
  "VP Jurídico",
  "VP Novos Negócios",
  "VP Pessoas",
  "VP TI",
];

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
  canDelete,
  onDelete,
}: TicketModalProps) {
  const router = useRouter();
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
    tags: [] as string[],
    attachmentName: '',
    attachmentUrl: '',
    dueDate: '',
    sprintId: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTypeHelp, setShowTypeHelp] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [epicSearch, setEpicSearch] = useState("");
  const [vpSearch, setVpSearch] = useState("");
  const [isEpicDropdownOpen, setIsEpicDropdownOpen] = useState(false);
  const [isVpDropdownOpen, setIsVpDropdownOpen] = useState(false);

  const vpContainerRef = useRef<HTMLDivElement>(null);
  const epicContainerRef = useRef<HTMLDivElement>(null);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vpContainerRef.current && !vpContainerRef.current.contains(event.target as Node)) {
        setIsVpDropdownOpen(false);
      }
      if (epicContainerRef.current && !epicContainerRef.current.contains(event.target as Node)) {
        setIsEpicDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // VPs filtradas pela busca
  const filteredVps = VP_OPTIONS.filter((vp) =>
    vp.toLowerCase().includes(vpSearch.trim().toLowerCase())
  );

  // States para anexos e parecer
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number; ext: string; url?: string } | null>(null);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [requirementOpinion, setRequirementOpinion] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      import("@/app/actions/tickets").then(({ getUsers }) => getUsers()),
      import("@/app/actions/cadastros").then(({ getSprints }) => getSprints()),
    ])
      .then(([usersList, sprintsList]) => {
        setUsers(usersList);
        setSprints(sprintsList);
      })
      .catch(console.error);
  }, []);

  // Lista de Épicos disponíveis para relacionamento pai
  const availableEpics = allTickets.filter(
    (t) => (t.type?.trim().toUpperCase() === 'EPICO') && (mode === 'create' || t.id !== ticket?.id)
  );

  // Épicos filtrados por número do chamado (SPN-XXXXXX, ID completo, prefixo UUID) ou por título
  const filteredEpics = availableEpics.filter((epic) => {
    const rawQuery = epicSearch.trim().toLowerCase();
    if (!rawQuery) return true;

    // Remove prefixos como 'spn-', 'spn', '#', 'spn:', etc.
    const cleanQuery = rawQuery.replace(/^(spn[-:\s]?|#)/i, "").trim();

    const fullId = epic.id.toLowerCase();
    const startId = epic.id.slice(0, 8).toLowerCase();
    const endId = epic.id.slice(-6).toLowerCase();

    const epicCodeFull = `spn-${fullId}`;
    const epicCodeStart = `spn-${startId}`;
    const epicCodeEnd = `spn-${endId}`;

    const title = (epic.title || "").toLowerCase();

    return (
      fullId.includes(rawQuery) ||
      (cleanQuery && fullId.includes(cleanQuery)) ||
      startId.includes(rawQuery) ||
      (cleanQuery && startId.includes(cleanQuery)) ||
      endId.includes(rawQuery) ||
      (cleanQuery && endId.includes(cleanQuery)) ||
      epicCodeFull.includes(rawQuery) ||
      epicCodeStart.includes(rawQuery) ||
      epicCodeEnd.includes(rawQuery) ||
      title.includes(rawQuery) ||
      `${epicCodeEnd} - ${title}`.includes(rawQuery) ||
      `${epicCodeStart} - ${title}`.includes(rawQuery)
    );
  });

  // Épico selecionado atualmente
  const selectedEpic = availableEpics.find((e) => e.id === formData.parentEpicId);

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
        tags: ticket.tags || [],
        attachmentName: ticket.attachmentName || '',
        attachmentUrl: ticket.attachmentUrl || '',
        dueDate: ticket.dueDate ? new Date(ticket.dueDate).toISOString().slice(0, 10) : '',
        sprintId: ticket.sprintId || '',
      });

      if (ticket.attachmentName) {
        setAttachedFile({
          name: ticket.attachmentName,
          size: 0,
          ext: ticket.attachmentName.split('.').pop() || '',
          url: ticket.attachmentUrl || '',
        });
      } else {
        setAttachedFile(null);
      }
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
        tags: [],
        attachmentName: '',
        attachmentUrl: '',
        dueDate: '',
        sprintId: '',
      });
      setAttachedFile(null);
    }
    setErrors({});
    setRequirementOpinion(null);
    setEpicSearch("");
  }, [ticket, defaultStatusId, currentUser]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = 'Título é obrigatório';
    if (formData.title.trim().length < 3) newErrors.title = 'Título deve ter pelo menos 3 caracteres';
    if (!formData.assignee.trim()) newErrors.assignee = 'O preenchimento do Responsável é obrigatório';
    if (!formData.type) newErrors.type = 'O tipo de chamado é obrigatório';

    if ((formData.type === 'ATIVIDADE' || formData.type === 'TAREFA') && (!formData.parentEpicId || formData.parentEpicId === 'none')) {
      newErrors.parentEpicId = 'Vínculo a um Épico Pai é OBRIGATÓRIO para Atividades e Tarefas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    setAttachedFile({ name: file.name, size: file.size, ext });
    setAnalyzingFile(true);

    try {
      const client = createClient();
      const storagePath = `tickets/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: uploadError } = await client.storage
        .from("qa-temp-evidences")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Erro ao enviar arquivo: ${uploadError.message}`);
      }

      setFormData((prev) => ({
        ...prev,
        attachmentName: file.name,
        attachmentUrl: storagePath,
      }));

      const requirementsDataset = (await import("@/requisitos-sd.json")).default;
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
    } catch (err: any) {
      console.error("Erro na análise/upload de anexo:", err);
      setErrors((prev) => ({ ...prev, file: err.message || 'Erro no upload' }));
    } finally {
      setAnalyzingFile(false);
    }
  };

  const getDownloadUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const client = createClient();
    const { data } = client.storage.from("qa-temp-evidences").getPublicUrl(path);
    return data.publicUrl;
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
      tags: formData.tags.map((t) => t.trim()).filter(Boolean),
      reporter_id: currentUser.id,
      attachmentName: formData.attachmentName || null,
      attachmentUrl: formData.attachmentUrl || null,
      dueDate: formData.dueDate ? new Date(formData.dueDate + 'T12:00:00').toISOString() : null,
      sprintId: formData.sprintId || null,
    };

    onSubmit(submitData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const toggleTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

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
              <div className="flex items-center gap-1 mb-1">
                <Label htmlFor="type" className="block text-sm font-medium text-gray-700">
                  Tipo do Chamado * {mode === 'edit' && <span className="text-xs text-amber-600">(Imutável)</span>}
                </Label>
                <div className="relative inline-flex">
                  <button
                    type="button"
                    aria-label="Ajuda sobre os tipos de chamado"
                    aria-haspopup="true"
                    aria-expanded={showTypeHelp}
                    onClick={() => setShowTypeHelp((prev) => !prev)}
                    onMouseEnter={() => setShowTypeHelp(true)}
                    onMouseLeave={() => setShowTypeHelp(false)}
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors focus:outline-none"
                  >
                    <CircleHelp className="h-3.5 w-3.5" />
                  </button>
                  {showTypeHelp && (
                    <div
                      role="tooltip"
                      className="absolute left-0 top-6 z-50 w-72 p-3 bg-white border border-slate-200 rounded-lg shadow-xl text-left animate-fadeIn"
                      onMouseEnter={() => setShowTypeHelp(true)}
                      onMouseLeave={() => setShowTypeHelp(false)}
                    >
                      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-900 mb-2">
                        Entendendo a Hierarquia:
                      </p>
                      <ul className="space-y-2 text-[11px] leading-relaxed text-slate-700">
                        <li>
                          <span className="font-bold text-purple-700">• Épico:</span> Uma grande iniciativa de negócio ou projeto de arquitetura que leva tempo para ser concluído.{" "}
                          <span className="italic text-slate-500">(Ex: Modernização da Infraestrutura de IAM).</span>
                        </li>
                        <li>
                          <span className="font-bold text-blue-700">• Atividade:</span> Um fluxo de trabalho menor, parte de um Épico, que entrega um valor específico.{" "}
                          <span className="italic text-slate-500">(Ex: Deploy de infraestrutura do provedor de identidade).</span>
                        </li>
                        <li>
                          <span className="font-bold text-emerald-700">• Tarefa:</span> Um esforço técnico e atômico executado por uma única pessoa para concluir uma Atividade.{" "}
                          <span className="italic text-slate-500">(Ex: Subir container localhost do Keycloak e validar rotas de autenticação).</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
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
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg space-y-2 relative">
              <div className="flex items-center justify-between">
                <Label htmlFor="parentEpicId" className="block text-xs font-bold text-purple-900 uppercase">
                  Épico Pai Vinculado *
                </Label>
                <span className="text-[10px] font-semibold text-purple-700">
                  Obrigatório para {formData.type === 'ATIVIDADE' ? 'Atividades' : 'Tarefas'}
                </span>
              </div>

              {/* Se já houver um Épico Selecionado */}
              {selectedEpic && !isEpicDropdownOpen ? (
                <div className="flex items-center justify-between p-2 bg-white border border-purple-300 rounded-md text-xs shadow-sm">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="font-mono font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded shrink-0">
                      SPN-{selectedEpic.id.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-slate-400 font-bold shrink-0">-</span>
                    <span className="font-medium text-slate-800 truncate">{selectedEpic.title}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      handleChange('parentEpicId', '');
                      setEpicSearch('');
                      setIsEpicDropdownOpen(true);
                    }}
                    className="h-6 px-2 text-[11px] text-purple-700 hover:bg-purple-100 shrink-0 font-semibold"
                  >
                    Alterar
                  </Button>
                </div>
              ) : (
                <div ref={epicContainerRef} className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-purple-400" />
                  <Input
                    type="text"
                    placeholder="Digite o número (ex: SPN-A1B2C3) ou título do Épico..."
                    value={epicSearch}
                    onFocus={() => setIsEpicDropdownOpen(true)}
                    onChange={(e) => {
                      setEpicSearch(e.target.value);
                      setIsEpicDropdownOpen(true);
                    }}
                    className={cn(
                      "h-9 pl-8 pr-8 text-xs bg-white border-purple-200 placeholder:text-purple-300 focus-visible:ring-purple-500",
                      errors.parentEpicId && "border-red-500 ring-1 ring-red-500"
                    )}
                    disabled={isLoading}
                  />

                  {/* Dropdown de Resultados da Busca */}
                  {isEpicDropdownOpen && (
                    <div className="absolute left-0 right-0 top-10 z-50 max-h-52 overflow-y-auto rounded-md border border-purple-200 bg-white shadow-xl animate-fadeIn">
                        {filteredEpics.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-500 font-medium">
                            {availableEpics.length === 0
                              ? "Nenhum Épico cadastrado. Crie um Épico primeiro!"
                              : `Nenhum Épico encontrado para "${epicSearch}".`}
                          </div>
                        ) : (
                          filteredEpics.map((epic) => {
                            const epicCode = `SPN-${epic.id.slice(-6).toUpperCase()}`;
                            return (
                              <div
                                key={epic.id}
                                onClick={() => {
                                  handleChange('parentEpicId', epic.id);
                                  setIsEpicDropdownOpen(false);
                                  setEpicSearch("");
                                }}
                                className="flex items-center gap-2 p-2.5 text-xs hover:bg-purple-50 cursor-pointer border-b border-purple-50 last:border-0 transition-colors"
                              >
                                <span className="font-mono font-bold text-purple-900 bg-purple-100 px-2 py-0.5 rounded shrink-0">
                                  {epicCode}
                                </span>
                                <span className="text-slate-400 font-bold shrink-0">-</span>
                                <span className="font-medium text-slate-800 truncate">{epic.title}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                  )}
                </div>
              )}

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

          {/* Sprint & Due Date Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sprintId" className="block text-sm font-medium text-gray-700 mb-1">
                Sprint
              </Label>
              <Select value={formData.sprintId || 'none'} onValueChange={(v: string) => handleChange('sprintId', v === 'none' ? '' : v)} disabled={isLoading}>
                <SelectTrigger id="sprintId">
                  <SelectValue placeholder="Selecione a sprint" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem sprint</SelectItem>
                  {sprints.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-semibold">{s.name}</span>
                      <span className="ml-2 text-xs text-gray-400">
                        {s.status === 'ATIVA' ? '· Ativa' : s.status === 'CONCLUIDA' ? '· Concluída' : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
                Data de Vencimento (Due Date)
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => handleChange('dueDate', e.target.value)}
                disabled={isLoading}
              />
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
                  {attachedFile.url || formData.attachmentUrl ? (
                    <a
                      href={getDownloadUrl(attachedFile.url || formData.attachmentUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary hover:underline"
                    >
                      {attachedFile.name}
                    </a>
                  ) : (
                    <span className="font-semibold text-slate-800">{attachedFile.name}</span>
                  )}
                  {attachedFile.size > 0 && (
                    <span className="text-slate-400">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> GZIP Ready
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full"
                    onClick={async () => {
                      const client = createClient();
                      const pathToDelete = attachedFile.url || formData.attachmentUrl;
                      if (pathToDelete) {
                        await client.storage.from("qa-temp-evidences").remove([pathToDelete]).catch(console.error);
                      }
                      setAttachedFile(null);
                      setFormData((prev) => ({
                        ...prev,
                        attachmentName: '',
                        attachmentUrl: '',
                      }));
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {errors.file && (
              <p className="text-xs text-red-600 font-semibold">{errors.file}</p>
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

          {/* Tags — Multi-select & Busca de VPs */}
          <div>
            <Label htmlFor="vp-input" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-gray-400" />
              Tags (Selecione a VP)
            </Label>
            <div ref={vpContainerRef} className="relative">
              <div
                className={cn(
                  "flex flex-wrap items-center gap-1.5 w-full min-h-[40px] rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => {
                  if (!isLoading) {
                    setIsVpDropdownOpen(true);
                  }
                }}
              >
                {formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 py-0 pr-1 select-none">
                    {tag}
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remover ${tag}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTag(tag);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleTag(tag);
                        }
                      }}
                      className="ml-0.5 rounded-full p-0.5 cursor-pointer hover:bg-gray-200"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                ))}
                <input
                  id="vp-input"
                  type="text"
                  placeholder={formData.tags.length === 0 ? "Digite para buscar ou selecione a VP..." : "Adicionar VP..."}
                  value={vpSearch}
                  onChange={(e) => {
                    setVpSearch(e.target.value);
                    setIsVpDropdownOpen(true);
                  }}
                  onFocus={() => setIsVpDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const trimmed = vpSearch.trim();
                      if (trimmed) {
                        const exactVp = VP_OPTIONS.find((v) => v.toLowerCase() === trimmed.toLowerCase());
                        const tagToAdd = exactVp || trimmed;
                        if (!formData.tags.includes(tagToAdd)) {
                          toggleTag(tagToAdd);
                        }
                        setVpSearch("");
                      }
                    } else if (e.key === "Backspace" && !vpSearch && formData.tags.length > 0) {
                      toggleTag(formData.tags[formData.tags.length - 1]);
                    }
                  }}
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-[120px] py-1"
                />
                <ChevronDown
                  className="h-4 w-4 opacity-50 shrink-0 ml-auto cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsVpDropdownOpen((prev) => !prev);
                  }}
                />
              </div>

              {/* Dropdown de VPs */}
              {isVpDropdownOpen && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-xl animate-fadeIn">
                  {filteredVps.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-500 font-medium">
                      Nenhuma VP encontrada para "{vpSearch}". Pressione Enter para adicionar.
                    </div>
                  ) : (
                    filteredVps.map((vp) => {
                      const selected = formData.tags.includes(vp);
                      return (
                        <div
                          key={vp}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTag(vp);
                          }}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 transition-colors border-b border-gray-50 last:border-0",
                            selected && "bg-primary/5 font-semibold text-primary"
                          )}
                        >
                          <span>{vp}</span>
                          {selected && <Check className="h-4 w-4 text-primary" />}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              {mode === 'edit' && ticket && (
                <a href={`/api/tickets/${ticket.id}/pdf`} target="_blank" rel="noopener noreferrer">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs text-primary border-primary/30">
                    <Download className="h-3.5 w-3.5" /> Exportar Relatório em PDF
                  </Button>
                </a>
              )}
              {mode === 'edit' && ticket && canDelete && onDelete && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(ticket)}
                  disabled={isLoading}
                  className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
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
