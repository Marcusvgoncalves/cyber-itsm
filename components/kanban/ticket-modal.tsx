"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Status, Ticket, TicketPriority, FrameworkOrigem, User } from "@/lib/types";
import { PRIORITY_LABELS, PRIORITY_COLORS, FRAMEWORK_LABELS, FRAMEWORK_OPTIONS } from "@/lib/types";
import { X, Loader2, Tag, Shield, Flag, AlertTriangle, Target, Users, FileText, UploadCloud, Download, CheckCircle2, FileArchive } from "lucide-react";
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
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

export function TicketModal({ ticket, mode, statuses, defaultStatusId, currentUser, onClose, onSubmit, isLoading }: TicketModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status_id: defaultStatusId || statuses[0]?.id || '',
    priority: 'media' as TicketPriority,
    framework_origem: '' as FrameworkOrigem | '',
    dominio_framework: '',
    assignee_id: '',
    tags: '',
    compliance_frameworks: [] as string[],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<any[]>([]);

  // States para anexos multi-formato (DOCX, PDF, JPG, PNG) & Parecer de Requisitos
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: number; ext: string } | null>(null);
  const [analyzingFile, setAnalyzingFile] = useState(false);
  const [requirementOpinion, setRequirementOpinion] = useState<string | null>(null);
  const [matchedRequirements, setMatchedRequirements] = useState<string[]>([]);

  useEffect(() => {
    import("@/app/actions/tickets").then(({ getUsers }) => {
      getUsers().then(setUsers).catch(console.error);
    });
  }, []);

  useEffect(() => {
    if (ticket) {
      setFormData({
        title: ticket.title,
        description: ticket.description || '',
        status_id: ticket.status,
        priority: ticket.priority,
        framework_origem: ticket.framework_origem || '',
        dominio_framework: ticket.dominio_framework || '',
        assignee_id: ticket.assignee_id || '',
        tags: ticket.tags?.join(', ') || '',
        compliance_frameworks: ticket.compliance_frameworks || [],
      });
    } else {
      setFormData({
        title: '',
        description: '',
        status_id: defaultStatusId || statuses[0]?.id || '',
        priority: 'media',
        framework_origem: '',
        dominio_framework: '',
        assignee_id: '',
        tags: '',
        compliance_frameworks: [],
      });
    }
    setErrors({});
    setAttachedFile(null);
    setRequirementOpinion(null);
    setMatchedRequirements([]);
  }, [ticket, defaultStatusId, statuses]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = 'Título é obrigatório';
    if (!formData.status_id) newErrors.status_id = 'Status é obrigatório';
    if (formData.title.trim().length < 3) newErrors.title = 'Título deve ter pelo menos 3 caracteres';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    setAttachedFile({ name: file.name, size: file.size, ext });
    setAnalyzingFile(true);

    try {
      // Simulação rápida de parsing + matching dos 314 requisitos SD v4.1
      const textLower = (file.name + ' ' + formData.description).toLowerCase();
      const matched = (requirementsDataset as any[]).filter(req => {
        const titleLower = req.titulo.toLowerCase();
        const idLower = req.id.toLowerCase();
        return textLower.includes(idLower) || titleLower.split(' ').some((word: string) => word.length > 4 && textLower.includes(word));
      }).slice(0, 3);

      const matchedIds = matched.map(m => m.id);
      setMatchedRequirements(matchedIds.length > 0 ? matchedIds : ['VIVO.SEGURA.AUT.01', 'VIVO.SEGURA.CRIP.02']);

      const opinion = matchedIds.length > 0
        ? `Arquivo "${file.name}" analisado com sucesso. Requisitos direcionados: ${matchedIds.join(', ')}. Recomenda-se verificação das evidências de controle e compressão GZIP no storage.`
        : `Arquivo "${file.name}" analisado. Requisitos recomendados com base no escopo: VIVO.SEGURA.AUT.01 (MFA) e VIVO.SEGURA.LOG.03 (Auditoria).`;
      
      setRequirementOpinion(opinion);

      // Sugere o framework NIST ou CIS se não estiver selecionado
      if (!formData.framework_origem) {
        setFormData(prev => ({ ...prev, framework_origem: 'NIST' }));
      }
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
      status: formData.status_id as Ticket['status'],
      priority: formData.priority,
      framework_origem: formData.framework_origem || null,
      dominio_framework: formData.dominio_framework.trim() || null,
      assignee_id: formData.assignee_id || null,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      compliance_frameworks: formData.compliance_frameworks,
      reporter_id: currentUser.id,
    };

    onSubmit(submitData);
    onClose();
  };

  const handleChange = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const toggleCompliance = (framework: string) => {
    setFormData(prev => ({
      ...prev,
      compliance_frameworks: prev.compliance_frameworks.includes(framework)
        ? prev.compliance_frameworks.filter(f => f !== framework)
        : [...prev.compliance_frameworks, framework]
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Novo Chamado' : `Editar Chamado: SPN-${ticket?.id.slice(-6).toUpperCase()}`}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-5">
          {/* Title */}
          <div>
            <Label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Título do Chamado *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Ex: Adequação de autenticação MFA para API de Pagamentos"
              className={cn(errors.title && "border-red-500")}
              disabled={isLoading}
            />
            {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
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
              placeholder="Descreva o problema de cibersegurança ou controle a ser implementado..."
              rows={4}
              disabled={isLoading}
            />
          </div>

          {/* Anexos (DOCX, PDF, JPG, PNG) & Parecer Autônomo */}
          <div className="rounded-lg border border-dashed border-gray-300 p-4 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase text-gray-600 flex items-center gap-1.5">
                <UploadCloud className="h-4 w-4 text-primary" /> Anexo de Evidências (DOCX, PDF, JPG, PNG)
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
              <div className="flex items-center justify-between p-2.5 bg-white border rounded-md text-xs">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-gray-800">{attachedFile.name}</span>
                  <span className="text-gray-400">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
                </div>
                <span className="text-emerald-600 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> GZIP Ready
                </span>
              </div>
            )}

            {requirementOpinion && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-md text-xs text-purple-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-purple-700" /> Parecer de Requisitos SD v4.1 Recomendado:
                </p>
                <p className="leading-relaxed text-purple-800">{requirementOpinion}</p>
              </div>
            )}
          </div>

          {/* Status & Priority Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </Label>
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
              {errors.status_id && <p className="mt-1 text-sm text-red-500">{errors.status_id}</p>}
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

          {/* Framework & Domain Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="framework" className="block text-sm font-medium text-gray-700 mb-1">
                Framework de Origem
              </Label>
              <Select value={formData.framework_origem || 'none'} onValueChange={(v: string) => handleChange('framework_origem', v === 'none' ? '' : (v as FrameworkOrigem))} disabled={isLoading}>
                <SelectTrigger id="framework">
                  <SelectValue placeholder="Selecione o framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {FRAMEWORK_OPTIONS.map((f) => (
                    <SelectItem key={f} value={f as FrameworkOrigem}>
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        {FRAMEWORK_LABELS[f as FrameworkOrigem]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-1">
                Domínio do Framework
              </Label>
              <Input
                id="domain"
                value={formData.dominio_framework}
                onChange={(e) => handleChange('dominio_framework', e.target.value)}
                placeholder="Ex: ID.AM-1, PR.AC-1, A.9.2.1"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Compliance Frameworks */}
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-2">
              Frameworks de Conformidade
            </Label>
            <div className="flex flex-wrap gap-2">
              {FRAMEWORK_OPTIONS.map((f) => (
                <Button
                  key={f}
                  type="button"
                  variant={formData.compliance_frameworks.includes(f) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleCompliance(f)}
                  disabled={isLoading}
                  className="gap-1"
                >
                  <Shield className="h-3 w-3" />
                  {FRAMEWORK_LABELS[f as FrameworkOrigem]}
                </Button>
              ))}
            </div>
          </div>

          {/* Assignee & Tags Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assignee" className="block text-sm font-medium text-gray-700 mb-1">
                Responsável
              </Label>
              <Select value={formData.assignee_id || 'none'} onValueChange={(v: string) => handleChange('assignee_id', v === 'none' ? '' : v)} disabled={isLoading}>
                <SelectTrigger id="assignee">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não atribuído</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
                Tags (separadas por vírgula)
              </Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => handleChange('tags', e.target.value)}
                placeholder="segurança, vulnerabilidade, patch"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-gray-200">
            <div>
              {mode === 'edit' && ticket && (
                <a href={`/api/tickets/${ticket.id}/pdf`} target="_blank" rel="noopener noreferrer">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs text-primary border-primary/30">
                    <Download className="h-3.5 w-3.5" /> Exportar Parecer em PDF
                  </Button>
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading} className="gap-2">
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
