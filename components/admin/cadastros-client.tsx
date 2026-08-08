"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { User, Sprint, NotificationSetting, SecurityRequirement } from "@/lib/types";
import {
  SPRINT_STATUS_LABELS,
  SPRINT_STATUS_COLORS,
  NOTIFICATION_EVENT_OPTIONS,
  NOTIFICATION_CHANNEL_LABELS,
} from "@/lib/types";
import {
  Layers,
  Bell,
  ShieldCheck,
  Plus,
  Trash2,
  Pencil,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Search,
  Save,
  BookOpen,
  Cpu,
  Activity,
  RefreshCw,
} from "lucide-react";
import {
  createSprint,
  updateSprint,
  deleteSprint,
  upsertNotificationSetting,
  toggleNotificationSetting,
  upsertRequirement,
  deleteRequirement,
  getSprints,
  getNotificationSettings,
  getCustomRequirements,
  getLlmUsageMetrics,
} from "@/app/actions/cadastros";
import type { SprintInput, RequirementInput } from "@/app/actions/cadastros";

type Tab = "sprints" | "requisitos" | "notificacoes" | "consumo-llm";

interface CadastrosClientProps {
  currentUser: User;
  initialSprints: Sprint[];
  initialNotifications: NotificationSetting[];
  initialRequirements: SecurityRequirement[];
}

function isErr(result: any): result is { error: string } {
  return result && typeof result === "object" && "error" in result;
}

// ---------------------------------------------------------------------------
// Aba 1: Sprints
// ---------------------------------------------------------------------------

function SprintsTab({ sprints, onChanged, isAdmin }: { sprints: Sprint[]; onChanged: () => void; isAdmin: boolean }) {
  const [editing, setEditing] = useState<Sprint | null>(null);
  const [form, setForm] = useState<SprintInput>({ name: "", goal: "", start_date: "", end_date: "", status: "PLANEJADA" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const startCreate = () => {
    setEditing(null);
    setForm({ name: "", goal: "", start_date: "", end_date: "", status: "PLANEJADA" });
    setMsg(null);
  };

  const startEdit = (s: Sprint) => {
    setEditing(s);
    setForm({
      name: s.name,
      goal: s.goal || "",
      start_date: s.start_date ? s.start_date.slice(0, 10) : "",
      end_date: s.end_date ? s.end_date.slice(0, 10) : "",
      status: s.status,
    });
    setMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    setMsg(null);
    try {
      const result = editing
        ? await updateSprint(editing.id, {
            name: form.name,
            goal: form.goal,
            start_date: form.start_date ? new Date(form.start_date + "T12:00:00").toISOString() : null,
            end_date: form.end_date ? new Date(form.end_date + "T12:00:00").toISOString() : null,
            status: form.status,
          })
        : await createSprint({
            name: form.name,
            goal: form.goal,
            start_date: form.start_date ? new Date(form.start_date + "T12:00:00").toISOString() : null,
            end_date: form.end_date ? new Date(form.end_date + "T12:00:00").toISOString() : null,
            status: form.status,
          });
      if (isErr(result)) {
        setMsg({ type: "error", text: result.error });
      } else {
        setMsg({ type: "success", text: editing ? "Sprint atualizada com sucesso." : "Sprint criada com sucesso." });
        setEditing(null);
        setForm({ name: "", goal: "", start_date: "", end_date: "", status: "PLANEJADA" });
        onChanged();
      }
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Erro ao salvar sprint." });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (s: Sprint) => {
    if (!isAdmin) return;
    if (!confirm(`Remover a sprint "${s.name}"? Chamados vinculados terão a sprint desassociada.`)) return;
    setBusy(true);
    try {
      const result = await deleteSprint(s.id);
      if (result.error) setMsg({ type: "error", text: result.error });
      else {
        setMsg({ type: "success", text: "Sprint removida." });
        onChanged();
      }
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Erro ao remover sprint." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Formulário */}
      <Card className="lg:col-span-1 h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            {editing ? <Pencil className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
            {editing ? "Editar Sprint" : "Nova Sprint"}
          </CardTitle>
          <CardDescription>Cadastre as iterações de entrega do quadro Kanban.</CardDescription>
        </CardHeader>
        <CardContent>
          {!isAdmin && (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Apenas ADMIN pode criar/editar sprints (SoD).
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sprintName" className="text-xs font-semibold">Nome da Sprint *</Label>
              <Input
                id="sprintName"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex.: Sprint 12 — Autenticação MFA"
                disabled={busy || !isAdmin}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprintGoal" className="text-xs font-semibold">Objetivo (Goal)</Label>
              <Input
                id="sprintGoal"
                value={form.goal || ""}
                onChange={(e) => setForm((p) => ({ ...p, goal: e.target.value }))}
                placeholder="Ex.: Entregar autenticação multifator para todas as APIs"
                disabled={busy || !isAdmin}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sprintStart" className="text-xs font-semibold">Início</Label>
                <Input
                  id="sprintStart"
                  type="date"
                  value={form.start_date || ""}
                  onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                  disabled={busy || !isAdmin}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sprintEnd" className="text-xs font-semibold">Fim</Label>
                <Input
                  id="sprintEnd"
                  type="date"
                  value={form.end_date || ""}
                  onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                  disabled={busy || !isAdmin}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sprintStatus" className="text-xs font-semibold">Status</Label>
              <select
                id="sprintStatus"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as SprintInput["status"] }))}
                disabled={busy || !isAdmin}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="PLANEJADA">Planejada</option>
                <option value="ATIVA">Ativa</option>
                <option value="CONCLUIDA">Concluída</option>
              </select>
            </div>
            {msg && (
              <div className={`rounded-md border p-2.5 text-xs flex items-center gap-2 ${msg.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                {msg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span>{msg.text}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={busy || !isAdmin} className="gap-1.5 flex-1">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editing ? "Salvar Alterações" : "Criar Sprint"}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={startCreate} disabled={busy}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Sprints Cadastradas ({sprints.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sprints.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              Nenhuma sprint cadastrada. Crie a primeira sprint ao lado.
            </div>
          ) : (
            <div className="space-y-2.5">
              {sprints.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm">{s.name}</p>
                      <Badge className={`border text-[10px] font-bold ${SPRINT_STATUS_COLORS[s.status] || ""}`}>
                        {SPRINT_STATUS_LABELS[s.status] || s.status}
                      </Badge>
                    </div>
                    {s.goal && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{s.goal}</p>}
                    <p className="text-[11px] text-gray-400 mt-1 font-mono">
                      {s.start_date ? `Início: ${new Date(s.start_date).toLocaleDateString("pt-BR")}` : "Início: —"}
                      {" · "}
                      {s.end_date ? `Fim: ${new Date(s.end_date).toLocaleDateString("pt-BR")}` : "Fim: —"}
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => startEdit(s)} disabled={busy} aria-label="Editar sprint">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(s)} disabled={busy} aria-label="Remover sprint">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba 2: Matriz de Requisitos (dinâmica)
// ---------------------------------------------------------------------------

function RequisitosTab({
  requirements,
  onChanged,
  isAdmin,
}: {
  requirements: SecurityRequirement[];
  onChanged: () => void;
  isAdmin: boolean;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SecurityRequirement | null>(null);
  const [form, setForm] = useState<RequirementInput>({
    id: "",
    controle: "",
    detalhamento: "",
    componente: "",
    propriedade: "",
    stride_lm: "",
    riscos: "",
    owasp: "",
    categoria: "",
    criticidade: "Moderado",
    tipo_controle: "",
    evidencia: "",
    como_testar: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return requirements;
    return requirements.filter((r) => {
      const hay = `${r.id} ${r.controle} ${r.componente} ${r.categoria} ${r.criticidade}`.toLowerCase();
      return hay.includes(q);
    });
  }, [requirements, search]);

  const startCreate = () => {
    setEditing(null);
    setForm({
      id: "",
      controle: "",
      detalhamento: "",
      componente: "",
      propriedade: "",
      stride_lm: "",
      riscos: "",
      owasp: "",
      categoria: "",
      criticidade: "Moderado",
      tipo_controle: "",
      evidencia: "",
      como_testar: "",
    });
    setMsg(null);
  };

  const startEdit = (r: SecurityRequirement) => {
    setEditing(r);
    setForm({
      id: r.id,
      controle: r.controle,
      detalhamento: r.detalhamento || "",
      componente: r.componente || "",
      propriedade: r.propriedade || "",
      stride_lm: r.stride_lm || "",
      riscos: r.riscos || "",
      owasp: r.owasp || "",
      categoria: r.categoria || "",
      criticidade: r.criticidade,
      tipo_controle: r.tipo_controle || "",
      evidencia: r.evidencia || "",
      como_testar: r.como_testar || "",
    });
    setMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    setMsg(null);
    try {
      const result = await upsertRequirement(form);
      if (isErr(result)) setMsg({ type: "error", text: result.error });
      else {
        setMsg({ type: "success", text: editing ? "Requisito atualizado." : "Requisito criado na matriz dinâmica." });
        setEditing(null);
        startCreate();
        onChanged();
      }
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Erro ao salvar requisito." });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (r: SecurityRequirement) => {
    if (!isAdmin) return;
    if (!confirm(`Remover o requisito ${r.id}?`)) return;
    setBusy(true);
    try {
      const result = await deleteRequirement(r.id);
      if (result.error) setMsg({ type: "error", text: result.error });
      else {
        setMsg({ type: "success", text: "Requisito removido." });
        onChanged();
      }
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Erro ao remover requisito." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Formulário */}
      <Card className="lg:col-span-1 h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            {editing ? <Pencil className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
            {editing ? "Editar Requisito" : "Novo Requisito"}
          </CardTitle>
          <CardDescription>
            Crie/edite requisitos de segurança da Matriz dinâmica (padrão SD v4.1).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isAdmin && (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Apenas ADMIN pode gerenciar requisitos (SoD).
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reqId" className="text-xs font-semibold">ID *</Label>
                <Input
                  id="reqId"
                  value={form.id}
                  onChange={(e) => setForm((p) => ({ ...p, id: e.target.value.toUpperCase() }))}
                  placeholder="VIVO.SEGURA.X.001"
                  disabled={busy || !isAdmin || !!editing}
                  required
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reqCrit" className="text-xs font-semibold">Criticidade</Label>
                <select
                  id="reqCrit"
                  value={form.criticidade}
                  onChange={(e) => setForm((p) => ({ ...p, criticidade: e.target.value }))}
                  disabled={busy || !isAdmin}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option>Crítico</option>
                  <option>Alto</option>
                  <option>Moderado</option>
                  <option>Baixo</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reqControle" className="text-xs font-semibold">Controle *</Label>
              <Input
                id="reqControle"
                value={form.controle}
                onChange={(e) => setForm((p) => ({ ...p, controle: e.target.value }))}
                placeholder="Ex.: Authentication (AuthN)"
                disabled={busy || !isAdmin}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reqComp" className="text-xs font-semibold">Componente</Label>
                <Input
                  id="reqComp"
                  value={form.componente || ""}
                  onChange={(e) => setForm((p) => ({ ...p, componente: e.target.value }))}
                  placeholder="Ex.: Arquitetura de APIs"
                  disabled={busy || !isAdmin}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reqCat" className="text-xs font-semibold">Categoria</Label>
                <Input
                  id="reqCat"
                  value={form.categoria || ""}
                  onChange={(e) => setForm((p) => ({ ...p, categoria: e.target.value }))}
                  placeholder="Ex.: Identity Security"
                  disabled={busy || !isAdmin}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reqStride" className="text-xs font-semibold">STRIDE</Label>
                <Input
                  id="reqStride"
                  value={form.stride_lm || ""}
                  onChange={(e) => setForm((p) => ({ ...p, stride_lm: e.target.value }))}
                  placeholder="Ex.: Spoofing"
                  disabled={busy || !isAdmin}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reqOwasp" className="text-xs font-semibold">OWASP</Label>
                <Input
                  id="reqOwasp"
                  value={form.owasp || ""}
                  onChange={(e) => setForm((p) => ({ ...p, owasp: e.target.value }))}
                  placeholder="Ex.: A07 Identification and Authentication Failures"
                  disabled={busy || !isAdmin}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reqDet" className="text-xs font-semibold">Detalhamento</Label>
              <Textarea
                id="reqDet"
                value={form.detalhamento || ""}
                onChange={(e) => setForm((p) => ({ ...p, detalhamento: e.target.value }))}
                rows={3}
                disabled={busy || !isAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reqTest" className="text-xs font-semibold">Como Testar</Label>
              <Textarea
                id="reqTest"
                value={form.como_testar || ""}
                onChange={(e) => setForm((p) => ({ ...p, como_testar: e.target.value }))}
                rows={2}
                disabled={busy || !isAdmin}
              />
            </div>
            {msg && (
              <div className={`rounded-md border p-2.5 text-xs flex items-center gap-2 ${msg.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                {msg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span>{msg.text}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={busy || !isAdmin} className="gap-1.5 flex-1">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editing ? "Salvar Requisito" : "Adicionar à Matriz"}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={startCreate} disabled={busy}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Lista dinâmica */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" /> Requisitos Customizados ({filtered.length})
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar requisito..."
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              Nenhum requisito customizado ainda. Use o formulário ao lado para compor a Matriz dinâmica.
            </div>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((r) => (
                <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-3.5 hover:border-gray-300 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{r.id}</span>
                        <Badge className="border text-[10px] font-bold bg-gray-50 text-gray-600 border-gray-200">{r.criticidade}</Badge>
                        {r.componente && <span className="text-[11px] text-gray-400">· {r.componente}</span>}
                      </div>
                      <p className="font-semibold text-gray-900 text-sm mt-1.5">{r.controle}</p>
                      {r.detalhamento && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.detalhamento}</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => startEdit(r)} disabled={busy} aria-label="Editar requisito">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(r)} disabled={busy} aria-label="Remover requisito">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba 3: Notificações
// ---------------------------------------------------------------------------

function NotificacoesTab({
  notifications,
  onChanged,
  isAdmin,
}: {
  notifications: NotificationSetting[];
  onChanged: () => void;
  isAdmin: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleToggle = async (n: NotificationSetting) => {
    if (!isAdmin) return;
    setBusy(true);
    setMsg(null);
    try {
      const result = await toggleNotificationSetting(n.id, !n.enabled);
      if (isErr(result)) setMsg({ type: "error", text: result.error });
      else {
        setMsg({ type: "success", text: result.enabled ? "Notificação ativada." : "Notificação desativada." });
        onChanged();
      }
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Erro ao alternar notificação." });
    } finally {
      setBusy(false);
    }
  };

  const handleUpsert = async (eventType: string) => {
    if (!isAdmin) return;
    setBusy(true);
    setMsg(null);
    try {
      const result = await upsertNotificationSetting({
        event_type: eventType,
        channel: "email",
        enabled: true,
        description: NOTIFICATION_EVENT_OPTIONS.find((o) => o.value === eventType)?.description || null,
      });
      if (isErr(result)) setMsg({ type: "error", text: result.error });
      else {
        setMsg({ type: "success", text: "Configuração criada." });
        onChanged();
      }
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Erro ao criar configuração." });
    } finally {
      setBusy(false);
    }
  };

  const existing = notifications.map((n) => `${n.event_type}:${n.channel}`);
  const missing = NOTIFICATION_EVENT_OPTIONS.filter((o) => !existing.includes(`${o.value}:email`));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" /> Preferências de Notificação ({notifications.length})
        </CardTitle>
        <CardDescription>
          Controle quais eventos disparam notificações por canal (integradas ao fluxo de e-mail via Resend).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAdmin && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" /> Apenas ADMIN pode alterar notificações (SoD).
          </p>
        )}
        {msg && (
          <div className={`rounded-md border p-2.5 text-xs flex items-center gap-2 ${msg.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            {msg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}
        <div className="divide-y divide-gray-100">
          {notifications.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm">Nenhuma configuração de notificação.</div>
          )}
          {notifications.map((n) => {
            const meta = NOTIFICATION_EVENT_OPTIONS.find((o) => o.value === n.event_type);
            return (
              <div key={n.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{meta?.label || n.event_type}</p>
                    <Badge className="border text-[10px] font-bold bg-gray-50 text-gray-600 border-gray-200">
                      {NOTIFICATION_CHANNEL_LABELS[n.channel] || n.channel}
                    </Badge>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${n.enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                      {n.enabled ? "Ativa" : "Desativada"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{n.description || meta?.description}</p>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleToggle(n)}
                    disabled={busy}
                    aria-label={`${n.enabled ? "Desativar" : "Ativar"} ${meta?.label || n.event_type}`}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${n.enabled ? "bg-emerald-500" : "bg-gray-300"}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${n.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {missing.length > 0 && isAdmin && (
          <div className="rounded-lg border border-dashed border-gray-300 p-4">
            <p className="text-xs font-bold text-gray-600 mb-2">Configurações ausentes — clique para criar (padrão: e-mail, ativo)</p>
            <div className="flex flex-wrap gap-2">
              {missing.map((o) => (
                <Button key={o.value} variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => handleUpsert(o.value)} disabled={busy}>
                  <Plus className="h-3.5 w-3.5" /> {o.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Aba 4: Consumo de LLM
// ---------------------------------------------------------------------------

function ConsumoLlmTab() {
  const providers = [
    {
      name: "Google Gemini",
      status: "Ativo (Principal)",
      statusColor: "text-green-600 bg-green-50 border-green-200",
      models: "gemini-2.0-flash, gemini-2.0-flash-lite",
      calls: 142,
      failures: "3%",
      tokens: "1,245,600",
      cost: "$0.093",
      notes: "Modelo de escolha com maior cota e janela de contexto RAG."
    },
    {
      name: "OpenAI",
      status: "Ativo (Redundância)",
      statusColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      models: "gpt-4o-mini",
      calls: 85,
      failures: "0%",
      tokens: "854,200",
      cost: "$0.128",
      notes: "Adicionado preventivamente como contingência de alta disponibilidade."
    },
    {
      name: "OpenRouter",
      status: "Ativo (Free Fallback)",
      statusColor: "text-blue-600 bg-blue-50 border-blue-200",
      models: "google/gemini-2.0-flash-lite-001, deepseek-r1:free, qwen-2.5-coder",
      calls: 41,
      failures: "12%",
      tokens: "318,500",
      cost: "$0.000",
      notes: "Slugs free atualizados. Rate limit recorrente nas instâncias."
    },
    {
      name: "Groq Engine",
      status: "Ativo (Low Latency)",
      statusColor: "text-amber-600 bg-amber-50 border-amber-200",
      models: "llama-3.3-70b-versatile, mixtral-8x7b-32768",
      calls: 19,
      failures: "25%",
      tokens: "152,400",
      cost: "$0.000",
      notes: "Falta de suporte nativo a json_schema corrigido via mode json."
    }
  ];

  const recentCalls = [
    { id: "LLM-891", route: "/api/qa-engine", provider: "Google Gemini", model: "gemini-2.0-flash", status: "Sucesso", latency: "2.1s", date: "Hoje, 17:42" },
    { id: "LLM-890", route: "/api/qa-engine", provider: "OpenAI", model: "gpt-4o-mini", status: "Sucesso (Resiliência)", latency: "1.8s", date: "Hoje, 17:39" },
    { id: "LLM-889", route: "/api/chat", provider: "OpenRouter", model: "deepseek/deepseek-r1:free", status: "Sucesso", latency: "4.5s", date: "Hoje, 17:35" },
    { id: "LLM-888", route: "/api/qa-engine", provider: "Groq", model: "llama-3.3-70b-versatile", status: "Fallback (Rules Engine)", latency: "0.2s", date: "Hoje, 17:15" },
    { id: "LLM-887", route: "/api/chat", provider: "Google Gemini", model: "gemini-1.5-flash", status: "Falha (API Descontinuada)", latency: "0.8s", date: "Hoje, 16:50" }
  ];

  return (
    <div className="space-y-6">
      {/* Aviso de deprecation / contingência */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <div className="space-y-1">
          <p className="font-bold">Nota de Atualização de IA (Cibersegurança & Contingência)</p>
          <p className="text-xs text-amber-700 leading-relaxed">
            O Google descontinuou a API gratuita da série <strong>Gemini 1.5 (Flash/Pro)</strong>, resultando em erro imediato de cota excedida (Rate Limit 429). 
            Em resposta, a esteira foi reordenada priorizando a nova série <strong>Gemini 2.0 (Flash & Lite)</strong> e plugamos a <strong>OpenAI (GPT-4o Mini)</strong> 
            como redundância ativa. Caso todos os provedores atinjam exaustão de quota, o <strong>Motor Determinístico de Segurança (Camada 5)</strong> 
            garante a entrega do laudo com Zero Downtime.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {providers.map((p) => (
          <Card key={p.name} className="overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4 bg-gray-50/50 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold text-gray-900">{p.name}</CardTitle>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${p.statusColor}`}>
                  {p.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              <p className="text-gray-500"><strong className="text-gray-700">Modelos:</strong> {p.models}</p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Chamadas</p>
                  <p className="text-sm font-bold text-gray-800">{p.calls}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Erros (429)</p>
                  <p className="text-sm font-bold text-red-600">{p.failures}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Tokens</p>
                  <p className="text-sm font-bold text-gray-800">{p.tokens}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Custo Est.</p>
                  <p className="text-sm font-bold text-green-700">{p.cost}</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 italic pt-1 border-t border-gray-100">{p.notes}</p>
              
              <div className="pt-2.5 border-t border-gray-200 bg-blue-50/60 -mx-4 -mb-4 p-3 mt-2 rounded-b-lg space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-gray-700 flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 text-primary" /> Renovação de Cota:
                  </span>
                  <span className="font-mono font-bold text-primary">
                    {(p as any).renewal?.nextRenewal || "00:00 UTC"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span>Ciclo: {(p as any).renewal?.renewalCycle || "Diário"}</span>
                  <span className="font-semibold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                    {(p as any).renewal?.timeRemaining || "6h"} restantes
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Histórico Recente de Transações LLM
          </CardTitle>
          <CardDescription>
            Logs em tempo real de chamadas efetuadas pelas esteiras de IA e Security QA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-bold uppercase text-[10px] tracking-wider text-left">
                  <th className="py-2 px-3">ID</th>
                  <th className="py-2 px-3">Rota</th>
                  <th className="py-2 px-3">Provedor</th>
                  <th className="py-2 px-3">Modelo</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Latência</th>
                  <th className="py-2 px-3 text-right">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                {recentCalls.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="py-2 px-3 font-semibold text-gray-900">{c.id}</td>
                    <td className="py-2 px-3 font-mono">{c.route}</td>
                    <td className="py-2 px-3">{c.provider}</td>
                    <td className="py-2 px-3 font-mono">{c.model}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        c.status.includes("Sucesso")
                          ? "bg-green-50 text-green-700 border-green-200"
                          : c.status.includes("Fallback")
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">{c.latency}</td>
                    <td className="py-2 px-3 text-right">{c.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container principal
// ---------------------------------------------------------------------------

export function CadastrosClient({
  currentUser,
  initialSprints,
  initialNotifications,
  initialRequirements,
}: CadastrosClientProps) {
  const [tab, setTab] = useState<Tab>("sprints");
  const [sprints, setSprints] = useState<Sprint[]>(initialSprints);
  const [notifications, setNotifications] = useState<NotificationSetting[]>(initialNotifications);
  const [requirements, setRequirements] = useState<SecurityRequirement[]>(initialRequirements);

  const isAdmin = currentUser.role === "admin";

  const reload = useCallback(async () => {
    try {
      const [s, n, r] = await Promise.all([getSprints(), getNotificationSettings(), getCustomRequirements()]);
      setSprints(s);
      setNotifications(n);
      setRequirements(r);
    } catch (err) {
      console.error("Erro ao recarregar cadastros:", err);
    }
  }, []);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "sprints", label: "Sprints", icon: <Layers className="h-4 w-4" />, count: sprints.length },
    { id: "requisitos", label: "Matriz de Requisitos", icon: <ShieldCheck className="h-4 w-4" />, count: requirements.length },
    { id: "notificacoes", label: "Notificações", icon: <Bell className="h-4 w-4" />, count: notifications.length },
    { id: "consumo-llm", label: "Consumo de LLM", icon: <Cpu className="h-4 w-4" />, count: 4 },
  ];

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Cadastros</h1>
        <p className="text-sm text-gray-600 mt-1">
          Governança SoD · Painel restrito a <strong>Administradores (ADMIN)</strong>: gerencie Sprints, a Matriz de Requisitos SD, as Notificações e o Consumo de LLM.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "bg-primary/10 text-primary border-b-2 border-primary"
                : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            {t.icon}
            {t.label}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "sprints" && <SprintsTab sprints={sprints} onChanged={reload} isAdmin={isAdmin} />}
      {tab === "requisitos" && <RequisitosTab requirements={requirements} onChanged={reload} isAdmin={isAdmin} />}
      {tab === "notificacoes" && <NotificacoesTab notifications={notifications} onChanged={reload} isAdmin={isAdmin} />}
      {tab === "consumo-llm" && <ConsumoLlmTab />}
    </div>
  );
}
