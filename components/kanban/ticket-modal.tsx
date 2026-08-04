"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Status, Ticket, TicketPriority, FrameworkOrigem, User } from "@/lib/types";
import { PRIORITY_LABELS, PRIORITY_COLORS, FRAMEWORK_LABELS, FRAMEWORK_OPTIONS } from "@/lib/types";
import { X, Loader2, Tag, Shield, Flag, AlertTriangle, Target, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  }, [ticket, defaultStatusId, statuses]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = 'Título é obrigatório';
    if (!formData.status_id) newErrors.status_id = 'Status é obrigatório';
    if (formData.title.trim().length < 3) newErrors.title = 'Título deve ter pelo menos 3 caracteres';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="space-y-5">
            {/* Title */}
            <div>
              <Label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Título <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="Descreva brevemente o chamado"
                className={errors.title ? 'border-red-500 focus:ring-red-500' : ''}
                disabled={isLoading}
                maxLength={200}
              />
              {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Detalhes do chamado, passos para reproduzir, impacto, etc."
                rows={4}
                className="resize-y"
                disabled={isLoading}
              />
            </div>

            {/* Status & Priority Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.status_id} onValueChange={(v: string) => handleChange('status_id', v)} disabled={isLoading}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                          {status.name}
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
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="gap-2">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Criar Chamado' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
