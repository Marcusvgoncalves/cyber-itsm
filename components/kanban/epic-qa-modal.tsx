"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, Sprint } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceUpload, type UploadedEvidence } from "@/components/security-qa/evidence-upload";
import { useQaResult } from "@/lib/security-qa/use-qa-result";
import {
  X,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ChevronRight,
  Bot,
  Layers,
  FileDown,
  Hourglass,
} from "lucide-react";

const RATING_LABEL: Record<string, string> = {
  baixo: "Baixo",
  medio: "Médio",
  alto: "Alto",
  critico: "Crítico",
};

const RATING_COLOR: Record<string, string> = {
  baixo: "text-green-700",
  medio: "text-amber-700",
  alto: "text-orange-700",
  critico: "text-red-700",
};

interface EpicQaModalProps {
  ticket: Ticket;
  sprints: Sprint[];
  onClose: () => void;
}

export function EpicQaModal({ ticket, sprints, onClose }: EpicQaModalProps) {
  const router = useRouter();
  const [environmentUrl, setEnvironmentUrl] = useState("");
  const [requirements, setRequirements] = useState("");
  const [evidence, setEvidence] = useState<UploadedEvidence | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Realtime: acompanha o lifecycle do laudo (PROCESSANDO -> CONCLUIDO/FALHA).
  const { phase, completion, error: realtimeError } = useQaResult(resultId);

  // Sprint associada ao épico (para nomear o projeto no laudo)
  const epicSprint = useMemo(() => sprints.find((s) => s.id === ticket.sprintId), [sprints, ticket.sprintId]);

  const running = submitting || phase === "processing";
  const error = submitError ?? realtimeError;
  const done = phase === "done" && completion !== null;

  const canRun =
    environmentUrl.trim().length > 0 &&
    requirements.trim().length > 0 &&
    evidence !== null &&
    !running;

  const handleRun = useCallback(async () => {
    if (!evidence) return;
    setSubmitting(true);
    setSubmitError(null);
    setResultId(null);

    try {
      const res = await fetch("/api/qa-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: ticket.title,
          environmentUrl: environmentUrl.trim(),
          requirements: requirements.trim(),
          fileName: evidence.fileName,
          storagePath: evidence.storagePath,
        }),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(payload?.error ?? `Falha na requisição (HTTP ${res.status}).`);
      }

      if (typeof payload?.id !== "string") {
        throw new Error("Resposta inesperada do motor: id ausente.");
      }

      setResultId(payload.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao enfileirar o Security QA.");
    } finally {
      setSubmitting(false);
    }
  }, [evidence, environmentUrl, requirements, ticket.title]);

  const handlePreloadRequirements = useCallback(async () => {
    setSubmitError(null);
    try {
      const dataset = (await import("@/requisitos-sd.json")).default as any[];
      const tagIds = (ticket.tags || []).map((t) => t.toLowerCase());
      const searchable = `${ticket.title} ${ticket.description || ""} ${ticket.framework_origem || ""}`.toLowerCase();

      const matched = dataset.filter((req) => {
        const haystack = `${req.controle || ""} ${req.componente || ""} ${req.categoria || ""} ${req.id || ""}`.toLowerCase();
        return tagIds.some((tag) => haystack.includes(tag)) || haystack.includes(searchable.trim());
      });

      const scoped = matched.length > 0 ? matched : dataset.slice(0, 10);
      setRequirements(scoped.map((r) => `${r.id} - ${r.controle}`).join("\n"));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Falha ao pré-carregar requisitos.");
    }
  }, [ticket]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />

      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-slate-50">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 leading-tight truncate">
                Testar Épico com Security QA
              </h2>
              <p className="text-[11px] text-gray-500 font-mono truncate">
                SPN-{ticket.id.slice(-6).toUpperCase()} · {ticket.title}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 shrink-0" disabled={running}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-5">
          {/* Metadados do Épico */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-purple-50/70 border border-purple-200 flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-600 shrink-0" />
              <div>
                <p className="font-bold text-purple-900">Framework de Origem</p>
                <p className="text-purple-700">{ticket.framework_origem || "Não informado"}</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 flex items-center gap-2">
              <Bot className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-900">Sprint Associada</p>
                <p className="text-emerald-700">
                  {epicSprint ? `${epicSprint.name} (${epicSprint.status})` : "Sem sprint vinculada"}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="epicEnvUrl" className="text-xs font-semibold">URL do Ambiente Avaliado *</Label>
            <Input
              id="epicEnvUrl"
              type="url"
              value={environmentUrl}
              onChange={(e) => setEnvironmentUrl(e.target.value)}
              placeholder="https://homologacao.corporativo.com.br"
              disabled={running}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="epicRequirements" className="text-xs font-semibold">
                Requisitos de Segurança (um por linha) *
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1"
                onClick={handlePreloadRequirements}
                disabled={running}
              >
                <Bot className="h-3 w-3" /> Sugerir do Épico
              </Button>
            </div>
            <Textarea
              id="epicRequirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder={"CYBER.SEGURA.AUT.01 - Autenticação MFA obrigatória\nCYBER.SEGURA.CRIP.02 - Tráfego TLS 1.2+"}
              rows={5}
              disabled={running}
            />
            <p className="text-xs text-gray-500">
              Recomenda-se usar os IDs da base SD v4.1. O botão "Sugerir do Épico" cruza tags/framework do chamado com a matriz.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Relatório de Segurança (evidência) *</Label>
            <EvidenceUpload disabled={running} onUploaded={setEvidence} onCleared={() => setEvidence(null)} />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-gray-500">
              {canRun
                ? "Pronto para iniciar a análise do épico em background."
                : running
                  ? "Processando Análise em Background..."
                  : "Preencha os campos e envie a evidência para testar o épico."}
            </p>
            <Button onClick={handleRun} disabled={!canRun} className="gap-2">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? "Processando..." : "Executar Teste"}
            </Button>
          </div>

          {/* Painel de status / resultado */}
          {running && (
            <div className="rounded-lg border border-gray-200 bg-slate-50 p-4 flex items-start gap-3">
              <Hourglass className="h-5 w-5 text-primary shrink-0 animate-pulse" />
              <div>
                <p className="text-sm font-semibold text-gray-800">Processando Análise em Background...</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  O laudo está sendo gerado pelos agentes de IA e o PDF será entregue automaticamente.
                  Você pode fechar este modal — o resultado chega via WebSocket (Supabase Realtime).
                </p>
              </div>
            </div>
          )}

          {done && completion && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm font-semibold text-gray-900">Análise concluída em background.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Score de Conformidade</p>
                  <p className="text-2xl font-bold text-primary">
                    {completion.compliancePercent !== null ? `${completion.compliancePercent.toFixed(1)}%` : "—"}
                  </p>
                  {completion.overallRating && (
                    <p className={`text-xs font-bold mt-0.5 ${RATING_COLOR[completion.overallRating] ?? ""}`}>
                      Risco {RATING_LABEL[completion.overallRating] ?? completion.overallRating}
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Requisitos Avaliados</p>
                  <p className="text-2xl font-bold text-gray-900">{completion.findings.length}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href={completion.pdfFileUrl ?? `/api/security-qa/${completion.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button size="sm" className="gap-1.5 shrink-0">
                    <FileDown className="h-4 w-4" /> Download PDF
                  </Button>
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/security-qa/project/${completion.id}`)}
                  className="gap-1.5 shrink-0"
                >
                  Abrir Laudo <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
