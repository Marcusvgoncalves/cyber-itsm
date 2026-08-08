"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { User, EnterpriseTool, EnterpriseToolType } from "@/lib/types";
import { ENTERPRISE_TOOL_LABELS } from "@/lib/types";
import {
  getEnterpriseTools,
  createEnterpriseTool,
  updateEnterpriseTool,
  deleteEnterpriseTool,
  toggleEnterpriseTool,
  testEnterpriseTool,
} from "@/app/actions/tools";
import {
  Building2,
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Network,
  Cloud,
  Workflow,
  CalendarDays,
} from "lucide-react";

interface EnterpriseToolsProps {
  currentUser: User;
}

function isErr(result: any): result is { error: string } {
  return result && typeof result === "object" && "error" in result;
}

const TOOL_FIELDS: Record<EnterpriseToolType, { key: string; label: string; placeholder: string; secret?: boolean }[]> = {
  jira: [
    { key: "base_url", label: "Base URL", placeholder: "https://empresa.atlassian.net" },
    { key: "email", label: "E-mail (conta de serviço)", placeholder: "admin@empresa.com" },
    { key: "api_token", label: "API Token", placeholder: "••••••••••", secret: true },
    { key: "project_key", label: "Project Key", placeholder: "CISEC" },
    { key: "issue_type", label: "Issue Type", placeholder: "Task" },
  ],
  servicenow: [
    { key: "instance_url", label: "Instance URL", placeholder: "https://dev00000.service-now.com" },
    { key: "client_id", label: "Client ID (OAuth)", placeholder: "Client ID" },
    { key: "client_secret", label: "Client Secret", placeholder: "••••••••••", secret: true },
    { key: "table", label: "Tabela Padrão", placeholder: "incident" },
    { key: "user", label: "Usuário (Basic Auth)", placeholder: "admin" },
  ],
  office365: [
    { key: "tenant_id", label: "Tenant ID", placeholder: "0000-0000-0000-0000" },
    { key: "client_id", label: "Client ID (Application)", placeholder: "Client ID" },
    { key: "client_secret", label: "Client Secret", placeholder: "••••••••••", secret: true },
    { key: "graph_endpoint", label: "Microsoft Graph Endpoint", placeholder: "https://graph.microsoft.com/v1.0" },
    { key: "organization", label: "Organização (Display Name)", placeholder: "CyberITSM Enterprise" },
  ],
};

function EmptyConfig(): Record<string, string> {
  return {
    base_url: "",
    email: "",
    api_token: "",
    project_key: "",
    issue_type: "Task",
    instance_url: "",
    client_id: "",
    client_secret: "",
    table: "incident",
    user: "",
    tenant_id: "",
    graph_endpoint: "https://graph.microsoft.com/v1.0",
    organization: "",
  };
}

function ToolForm({
  toolType,
  initial,
  isAdmin,
  onSaved,
  onCancel,
}: {
  toolType: EnterpriseToolType;
  initial: EnterpriseTool | null;
  isAdmin: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const fields = TOOL_FIELDS[toolType];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const base = EmptyConfig();
    if (initial) {
      const cfg = (initial.config || {}) as Record<string, unknown>;
      for (const f of fields) {
        const v = cfg[f.key];
        if (typeof v === "string") base[f.key] = v;
      }
    }
    return base;
  });
  const [name, setName] = useState(initial?.name ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    setMsg(null);
    try {
      const config: Record<string, unknown> = {};
      for (const f of fields) {
        const v = values[f.key]?.trim();
        if (v) config[f.key] = v;
      }
      const result = initial
        ? await updateEnterpriseTool(initial.id, { name: name.trim() || initial.name, tool_type: toolType, config })
        : await createEnterpriseTool({ name: name.trim(), tool_type: toolType, config });
      if (isErr(result)) {
        setMsg({ type: "error", text: result.error });
      } else {
        setMsg({ type: "success", text: initial ? "Integração atualizada com sucesso." : "Integração criada com sucesso." });
        onSaved();
      }
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Erro ao salvar integração." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border border-primary/30 rounded-lg bg-primary-light/20 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-gray-900 text-sm">{initial ? "Editar Integração" : "Nova Integração"}</p>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600" aria-label="Fechar">
          <X className="h-4 w-4" />
        </button>
      </div>
      {msg && (
        <div className={`text-xs p-2 rounded border ${
          msg.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
        }`}>
          {msg.text}
        </div>
      )}
      <div>
        <Label className="text-xs font-semibold">Nome da Integração *</Label>
        <Input className="h-8 text-sm mt-1" value={name} onChange={(e) => setName(e.target.value)} required placeholder={`Ex.: ${ENTERPRISE_TOOL_LABELS[toolType]} Produção`} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key}>
            <Label className="text-[11px] font-semibold">{f.label}</Label>
            <Input
              className="h-8 text-xs mt-1"
              type={f.secret ? "password" : "text"}
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <Button type="submit" disabled={busy} className="h-8 text-xs gap-1.5">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {initial ? "Salvar Alterações" : "Criar Integração"}
      </Button>
    </form>
  );
}

function ToolSection({
  toolType,
  tools,
  isAdmin,
  onChanged,
}: {
  toolType: EnterpriseToolType;
  tools: EnterpriseTool[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<EnterpriseTool | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useMemo(() => tools.filter((t) => t.tool_type === toolType), [tools, toolType]);

  const startCreate = () => {
    setEditing(null);
    setShowForm(true);
  };
  const startEdit = (t: EnterpriseTool) => {
    setEditing(t);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta integração?")) return;
    setBusyId(id);
    try {
      await deleteEnterpriseTool(id);
      onChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = async (t: EnterpriseTool) => {
    setBusyId(t.id);
    try {
      await toggleEnterpriseTool(t.id, !t.is_active);
      onChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleTest = async (id: string) => {
    setBusyId(id);
    try {
      await testEnterpriseTool(id);
      onChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {list.length === 0 && (
        <p className="text-xs text-gray-400">Nenhuma integração {ENTERPRISE_TOOL_LABELS[toolType]} cadastrada.</p>
      )}
      {list.map((t) => {
        const cfg = (t.config || {}) as Record<string, string>;
        const summary =
          toolType === "jira"
            ? cfg.base_url || "Sem base_url"
            : toolType === "servicenow"
              ? cfg.instance_url || "Sem instance_url"
              : cfg.organization || cfg.tenant_id || "Sem tenant_id";
        const tested = t.last_status?.toLowerCase().startsWith("ok");
        return (
          <div key={t.id} className="p-3 border border-gray-200 rounded-lg bg-white space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900 text-sm truncate">{t.name}</p>
                  <Badge variant={t.is_active ? "default" : "outline"} className={t.is_active ? "" : "text-gray-500"}>
                    {t.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{summary}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isAdmin && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => handleToggle(t)} disabled={busyId === t.id}>
                      {busyId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      <span className="ml-1">{t.is_active ? "Desativar" : "Ativar"}</span>
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => handleTest(t.id)} disabled={busyId === t.id}>
                      {busyId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Network className="h-3 w-3" />}
                      <span className="ml-1">Testar</span>
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => startEdit(t)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-2 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(t.id)} disabled={busyId === t.id}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            {t.last_status && (
              <div className={`text-[11px] flex items-center gap-1.5 ${
                tested ? "text-green-700" : t.last_status.startsWith("falhou") ? "text-red-700" : "text-gray-500"
              }`}>
                {tested ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : t.last_status.startsWith("falhou") ? <AlertTriangle className="h-3 w-3 text-red-600" /> : null}
                <span className="truncate">{t.last_status}</span>
                {t.last_tested_at && (
                  <span className="text-gray-400 shrink-0">
                    · {new Date(t.last_tested_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {isAdmin && !showForm && (
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-dashed" onClick={startCreate}>
          <Plus className="h-3.5 w-3.5" /> Nova Integração {ENTERPRISE_TOOL_LABELS[toolType]}
        </Button>
      )}
      {isAdmin && showForm && (
        <ToolForm
          toolType={toolType}
          initial={editing}
          isAdmin={isAdmin}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            onChanged();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container principal
// ---------------------------------------------------------------------------

export function EnterpriseTools({ currentUser }: EnterpriseToolsProps) {
  const isAdmin = currentUser.role === "admin";
  const [tools, setTools] = useState<EnterpriseTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const list = await getEnterpriseTools();
      setTools(list);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar integrações enterprise.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const types: EnterpriseToolType[] = ["jira", "servicenow", "office365"];

  const typeIcon: Record<EnterpriseToolType, React.ReactNode> = {
    jira: <Workflow className="h-4 w-4" />,
    servicenow: <Cloud className="h-4 w-4" />,
    office365: <CalendarDays className="h-4 w-4" />,
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Integrações com Ferramentas Enterprise
          </CardTitle>
          <CardDescription>
            Conexões seguras com Jira Software, ServiceNow (ITSM) e Microsoft 365 / Office 365 para interoperabilidade operacional.
          </CardDescription>
        </div>
        {!isAdmin && <Badge variant="outline" className="shrink-0 text-gray-500">Somente leitura</Badge>}
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="text-xs bg-red-50 text-red-700 border border-red-200 p-2.5 rounded">{error}</div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando integrações...
          </div>
        ) : (
          types.map((toolType) => (
            <div key={toolType} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-gray-600">
                  {typeIcon[toolType]}
                </span>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{ENTERPRISE_TOOL_LABELS[toolType]}</p>
                  <p className="text-xs text-gray-500">
                    {toolType === "jira"
                      ? "Atlassian · Gestão de demandas"
                      : toolType === "servicenow"
                        ? "ITSM / Service Management"
                        : "Microsoft Graph · Identidades e colaboração"}
                  </p>
                </div>
                <Badge variant="secondary" className="ml-auto">{tools.filter((t) => t.tool_type === toolType && t.is_active).length} ativa(s)</Badge>
              </div>
              <ToolSection toolType={toolType} tools={tools} isAdmin={isAdmin} onChanged={reload} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
