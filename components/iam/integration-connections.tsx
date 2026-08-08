"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { User, IntegrationConnection, IntegrationProtocol, MtlsConfig } from "@/lib/types";
import { INTEGRATION_PROTOCOL_LABELS } from "@/lib/types";
import {
  getIntegrationConnections,
  createIntegrationConnection,
  updateIntegrationConnection,
  deleteIntegrationConnection,
  toggleIntegrationConnection,
  testIntegrationConnection,
  getMtlsConfig,
  saveMtlsConfig,
} from "@/app/actions/integrations";
import {
  Plug,
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  KeyRound,
  Network,
  FileKey,
  Landmark,
} from "lucide-react";

interface IntegrationConnectionsProps {
  currentUser: User;
}

function isErr(result: any): result is { error: string } {
  return result && typeof result === "object" && "error" in result;
}

// ---------------------------------------------------------------------------
// mTLS Global Config
// ---------------------------------------------------------------------------

function MtlsPanel({ mtls, isAdmin, onSaved }: { mtls: MtlsConfig | null; isAdmin: boolean; onSaved: (m: MtlsConfig) => void }) {
  const [enabled, setEnabled] = useState(mtls?.enabled ?? false);
  const [requireClientCert, setRequireClientCert] = useState(mtls?.require_client_cert ?? true);
  const [caCert, setCaCert] = useState(mtls?.ca_cert ?? "");
  const [clientCert, setClientCert] = useState(mtls?.client_cert ?? "");
  const [clientKey, setClientKey] = useState(mtls?.client_key ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const sync = useCallback((m: MtlsConfig) => {
    setEnabled(m.enabled);
    setRequireClientCert(m.require_client_cert);
    setCaCert(m.ca_cert ?? "");
    setClientCert(m.client_cert ?? "");
    setClientKey(m.client_key ?? "");
  }, []);

  useEffect(() => {
    if (mtls) sync(mtls);
  }, [mtls, sync]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setBusy(true);
    setMsg(null);
    try {
      const result = await saveMtlsConfig({
        enabled,
        require_client_cert: requireClientCert,
        ca_cert: caCert,
        client_cert: clientCert,
        client_key: clientKey,
      });
      if (isErr(result)) {
        setMsg({ type: "error", text: result.error });
      } else {
        setMsg({ type: "success", text: "Configuração mTLS salva com sucesso." });
        onSaved(result);
      }
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Erro ao salvar configuração mTLS." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          Mutual TLS (mTLS) Global
        </CardTitle>
        <CardDescription>
          Autenticação mútua por certificado para todas as integrações outbound (OAuth, SAML, SCIM).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && (
          <div className={`text-xs p-2.5 rounded border ${
            msg.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
          }`}>
            {msg.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-bold text-gray-900 text-sm">mTLS Ativo</p>
                <p className="text-xs text-gray-500">Exigir certificado de cliente nas integrações</p>
              </div>
              <input
                type="checkbox"
                className="sr-only peer"
                disabled={!isAdmin}
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <div className="relative w-10 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-bold text-gray-900 text-sm">Validar Certificado do Cliente</p>
                <p className="text-xs text-gray-500">Exigir e validar o cert do cliente na chain de confiança</p>
              </div>
              <input
                type="checkbox"
                className="sr-only peer"
                disabled={!isAdmin}
                checked={requireClientCert}
                onChange={(e) => setRequireClientCert(e.target.checked)}
              />
              <div className="relative w-10 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold">Certificado CA de Confiança (.pem)</Label>
              <Textarea
                className="h-16 text-xs font-mono bg-white mt-1"
                placeholder="-----BEGIN CERTIFICATE-----"
                disabled={!isAdmin}
                value={caCert}
                onChange={(e) => setCaCert(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Client Certificate (.pem)</Label>
                <Textarea
                  className="h-16 text-xs font-mono bg-white mt-1"
                  placeholder="-----BEGIN CERTIFICATE-----"
                  disabled={!isAdmin}
                  value={clientCert}
                  onChange={(e) => setClientCert(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Private Key (.key)</Label>
                <Textarea
                  className="h-16 text-xs font-mono bg-white mt-1"
                  placeholder="-----BEGIN PRIVATE KEY-----"
                  disabled={!isAdmin}
                  value={clientKey}
                  onChange={(e) => setClientKey(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={enabled ? "default" : "outline"} className={enabled ? "" : "text-gray-500"}>
            {enabled ? "mTLS Ativado" : "mTLS Desativado"}
          </Badge>
          {!isAdmin && <span className="text-xs text-gray-400">Somente ADMIN pode alterar.</span>}
          {isAdmin && (
            <Button type="submit" onClick={handleSave} disabled={busy} className="ml-auto h-8 text-xs gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar Configuração
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Connection CRUD (por protocolo)
// ---------------------------------------------------------------------------

const PROTOCOL_FIELDS: Record<IntegrationProtocol, { key: string; label: string; placeholder: string; multiline?: boolean; secret?: boolean }[]> = {
  oauth2: [
    { key: "authorization_url", label: "Authorization URL", placeholder: "https://idp.example.com/oauth2/authorize" },
    { key: "token_url", label: "Token URL", placeholder: "https://idp.example.com/oauth2/token" },
    { key: "client_id", label: "Client ID", placeholder: "client-id" },
    { key: "client_secret", label: "Client Secret", placeholder: "••••••••••", secret: true },
    { key: "scopes", label: "Scopes (separados por espaço)", placeholder: "openid profile email" },
    { key: "grant_type", label: "Grant Type", placeholder: "authorization_code" },
    { key: "redirect_uri", label: "Redirect URI", placeholder: "https://app.example.com/callback" },
  ],
  saml: [
    { key: "idp_entity_id", label: "IdP Entity ID", placeholder: "https://sts.windows.net/tenant/" },
    { key: "sso_url", label: "SSO URL (IdP)", placeholder: "https://idp.example.com/saml2" },
    { key: "sp_entity_id", label: "SP Entity ID", placeholder: "https://app.example.com/api/saml/metadata" },
    { key: "acs_url", label: "ACS URL (Assertion Consumer)", placeholder: "https://app.example.com/api/saml/sso" },
    { key: "name_id_format", label: "NameID Format", placeholder: "emailAddress" },
    { key: "signing_cert", label: "Certificado de Assinatura do IdP", placeholder: "-----BEGIN CERTIFICATE-----", multiline: true },
  ],
  scim: [
    { key: "base_url", label: "Base URL (SCIM v2.0)", placeholder: "https://idp.example.com/scim/v2" },
    { key: "bearer_token", label: "Bearer Token", placeholder: "scim-token", secret: true },
    { key: "provisioning_direction", label: "Direção de Provisionamento", placeholder: "inbound" },
  ],
};

function EmptyConfig(): Record<string, string> {
  return { authorization_url: "", token_url: "", client_id: "", client_secret: "", scopes: "openid profile email", grant_type: "authorization_code", redirect_uri: "", idp_entity_id: "", sso_url: "", sp_entity_id: "", acs_url: "", name_id_format: "emailAddress", signing_cert: "", base_url: "", bearer_token: "", provisioning_direction: "inbound" };
}

function ConnForm({
  protocol,
  initial,
  isAdmin,
  onSaved,
  onCancel,
}: {
  protocol: IntegrationProtocol;
  initial: IntegrationConnection | null;
  isAdmin: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const fields = PROTOCOL_FIELDS[protocol];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const base = EmptyConfig();
    if (initial) {
      const cfg = (initial.config || {}) as Record<string, unknown>;
      for (const f of fields) {
        const v = cfg[f.key];
        if (typeof v === "string") base[f.key] = v;
        else if (Array.isArray(v)) base[f.key] = v.join(" ");
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
        if (f.key === "scopes" && v) config[f.key] = v.split(/\s+/);
        else if (v) config[f.key] = v;
      }
      const result = initial
        ? await updateIntegrationConnection(initial.id, { name: name.trim() || initial.name, protocol, config })
        : await createIntegrationConnection({ name: name.trim(), protocol, config });
      if (isErr(result)) {
        setMsg({ type: "error", text: result.error });
      } else {
        setMsg({ type: "success", text: initial ? "Conexão atualizada com sucesso." : "Conexão criada com sucesso." });
        onSaved();
      }
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Erro ao salvar conexão." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border border-primary/30 rounded-lg bg-primary-light/20 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-gray-900 text-sm">{initial ? "Editar Conexão" : "Nova Conexão"}</p>
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
        <Label className="text-xs font-semibold">Nome da Conexão *</Label>
        <Input className="h-8 text-sm mt-1" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ex.: Entra ID Produção" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key} className={f.multiline ? "md:col-span-2" : ""}>
            <Label className="text-[11px] font-semibold">{f.label}</Label>
            {f.multiline ? (
              <Textarea
                className="h-16 text-xs font-mono bg-white mt-1"
                placeholder={f.placeholder}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            ) : (
              <Input
                className="h-8 text-xs mt-1"
                type={f.secret ? "password" : "text"}
                placeholder={f.placeholder}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>
      <Button type="submit" disabled={busy} className="h-8 text-xs gap-1.5">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {initial ? "Salvar Alterações" : "Criar Conexão"}
      </Button>
    </form>
  );
}

function ProtocolSection({
  protocol,
  connections,
  isAdmin,
  onChanged,
}: {
  protocol: IntegrationProtocol;
  connections: IntegrationConnection[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IntegrationConnection | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useMemo(() => connections.filter((c) => c.protocol === protocol), [connections, protocol]);

  const startCreate = () => {
    setEditing(null);
    setShowForm(true);
  };
  const startEdit = (c: IntegrationConnection) => {
    setEditing(c);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta conexão?")) return;
    setBusyId(id);
    try {
      await deleteIntegrationConnection(id);
      onChanged();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = async (c: IntegrationConnection) => {
    setBusyId(c.id);
    try {
      await toggleIntegrationConnection(c.id, !c.is_active);
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
      await testIntegrationConnection(id);
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
        <p className="text-xs text-gray-400">Nenhuma conexão {INTEGRATION_PROTOCOL_LABELS[protocol]} cadastrada.</p>
      )}
      {list.map((c) => {
        const cfg = (c.config || {}) as Record<string, string>;
        const summary =
          protocol === "oauth2"
            ? cfg.token_url || "Sem token_url"
            : protocol === "saml"
              ? cfg.sso_url || "Sem sso_url"
              : cfg.base_url || "Sem base_url";
        const tested = c.last_status?.toLowerCase().startsWith("ok");
        return (
          <div key={c.id} className="p-3 border border-gray-200 rounded-lg bg-white space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900 text-sm truncate">{c.name}</p>
                  <Badge variant={c.is_active ? "default" : "outline"} className={c.is_active ? "" : "text-gray-500"}>
                    {c.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 font-mono truncate mt-0.5">{summary}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isAdmin && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => handleToggle(c)} disabled={busyId === c.id}>
                      {busyId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      <span className="ml-1">{c.is_active ? "Desativar" : "Ativar"}</span>
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => handleTest(c.id)} disabled={busyId === c.id}>
                      {busyId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Network className="h-3 w-3" />}
                      <span className="ml-1">Testar</span>
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-2" onClick={() => startEdit(c)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px] px-2 text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id)} disabled={busyId === c.id}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            {c.last_status && (
              <div className={`text-[11px] flex items-center gap-1.5 ${
                tested ? "text-green-700" : c.last_status.startsWith("falhou") ? "text-red-700" : "text-gray-500"
              }`}>
                {tested ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : c.last_status.startsWith("falhou") ? <AlertTriangle className="h-3 w-3 text-red-600" /> : null}
                <span className="truncate">{c.last_status}</span>
                {c.last_tested_at && (
                  <span className="text-gray-400 shrink-0">
                    · {new Date(c.last_tested_at).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {isAdmin && !showForm && (
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-dashed" onClick={startCreate}>
          <Plus className="h-3.5 w-3.5" /> Nova Conexão {INTEGRATION_PROTOCOL_LABELS[protocol]}
        </Button>
      )}
      {isAdmin && showForm && (
        <ConnForm
          protocol={protocol}
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

export function IntegrationConnections({ currentUser }: IntegrationConnectionsProps) {
  const isAdmin = currentUser.role === "admin";
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [mtls, setMtls] = useState<MtlsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [conns, mtl] = await Promise.all([getIntegrationConnections(), getMtlsConfig()]);
      setConnections(conns);
      setMtls(mtl);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar integrações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const protocols: IntegrationProtocol[] = ["oauth2", "saml", "scim"];

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-xs bg-red-50 text-red-700 border border-red-200 p-2.5 rounded">{error}</div>
      )}

      <MtlsPanel mtls={mtls} isAdmin={isAdmin} onSaved={(m) => setMtls(m)} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Plug className="h-5 w-5 text-primary" />
              Conexões de Integração
            </CardTitle>
            <CardDescription>
              Conexões corporativas via OAuth 2.0, SAML 2.0 e SCIM 2.0 para provisionamento e federacão de identidades.
            </CardDescription>
          </div>
          {!isAdmin && <Badge variant="outline" className="shrink-0 text-gray-500">Somente leitura</Badge>}
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando integrações...
            </div>
          ) : (
            protocols.map((protocol) => (
              <div key={protocol} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-gray-600">
                    {protocol === "oauth2" ? <KeyRound className="h-4 w-4" /> : protocol === "saml" ? <Landmark className="h-4 w-4" /> : <FileKey className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{INTEGRATION_PROTOCOL_LABELS[protocol]}</p>
                    <p className="text-xs text-gray-500">{protocol === "oauth2" ? "OAuth 2.0 / OpenID Connect" : protocol === "saml" ? "Security Assertion Markup Language" : "System for Cross-domain Identity Management"}</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto">{connections.filter((c) => c.protocol === protocol && c.is_active).length} ativa(s)</Badge>
                </div>
                <ProtocolSection protocol={protocol} connections={connections} isAdmin={isAdmin} onChanged={reload} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
