"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceUpload, type UploadedEvidence } from "@/components/security-qa/evidence-upload";
import type { QaAnalysis, QaStreamEvent } from "@/lib/security-qa/types";
import { ShieldAlert, Play, Loader2, CheckCircle2, XCircle, ArrowLeft, ChevronRight, Bot } from "lucide-react";

const PHASE_LABELS: Record<string, string> = {
  download: "Baixando evidência bruta",
  analysis: "Análise via Gemini",
  archive: "Compressão GZIP + arquivamento",
  purge: "Expurgo do dado bruto",
};

interface StreamState {
  phase: string | null;
  message: string | null;
  partial: Partial<QaAnalysis> | null;
}

export default function AssessPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [environmentUrl, setEnvironmentUrl] = useState("");
  const [requirements, setRequirements] = useState("");
  const [evidence, setEvidence] = useState<UploadedEvidence | null>(null);

  const [running, setRunning] = useState(false);
  const [streamState, setStreamState] = useState<StreamState>({ phase: null, message: null, partial: null });
  const [error, setError] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const canRun =
    projectName.trim().length > 0 &&
    environmentUrl.trim().length > 0 &&
    requirements.trim().length > 0 &&
    evidence !== null &&
    !running;

  const handleRun = useCallback(async () => {
    if (!evidence) return;
    setRunning(true);
    setError(null);
    setResultId(null);
    setStreamState({ phase: null, message: null, partial: null });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/qa-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: projectName.trim(),
          environmentUrl: environmentUrl.trim(),
          requirements: requirements.trim(),
          fileName: evidence.fileName,
          storagePath: evidence.storagePath,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? `Falha na requisição (HTTP ${res.status}).`);
      }

      if (!res.body) throw new Error("Stream vazio.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let doneId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;

          let event: QaStreamEvent;
          try {
            event = JSON.parse(line) as QaStreamEvent;
          } catch {
            continue;
          }

          if (event.type === "status") {
            setStreamState((prev) => ({ ...prev, phase: event.phase, message: event.message }));
          } else if (event.type === "delta") {
            setStreamState((prev) => ({
              ...prev,
              phase: "analysis",
              message: "Recebendo resultado parcial do modelo...",
              partial: { ...prev.partial, ...event.partial },
            }));
          } else if (event.type === "done") {
            doneId = event.result.id;
            setResultId(event.result.id);
            setStreamState((prev) => ({
              ...prev,
              phase: null,
              message: "Análise concluída e evidência arquivada com sucesso.",
              partial: null,
            }));
          } else if (event.type === "error") {
            setError(event.message);
          }
        }
      }

      if (doneId) router.push(`/security-qa/project/${doneId}`);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError(err instanceof Error ? err.message : "Erro ao executar o motor de IA.");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [evidence, projectName, environmentUrl, requirements, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold tracking-tight text-gray-900">
                Centro de Security QA <span className="text-vivo">SPN</span>
              </span>
            </div>
            <Link href="/security-qa" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Nova Avaliação de Segurança</h1>
          <p className="text-sm text-gray-600 mt-1">
            Envie o relatório de segurança, informe os requisitos e o motor cruza tudo via Gemini. O relatório original é
            comprimido (GZIP), arquivado e expurgado do bucket temporário automaticamente.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Identificação do Projeto</CardTitle>
            <CardDescription>Dados do ambiente avaliado e dos requisitos de arquitetura segura.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="projectName" className="text-xs font-semibold">Nome do Projeto</Label>
                <Input
                  id="projectName"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Ex.: Portal Corporativo"
                  disabled={running}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="environmentUrl" className="text-xs font-semibold">URL do Ambiente</Label>
                <Input
                  id="environmentUrl"
                  type="url"
                  value={environmentUrl}
                  onChange={(e) => setEnvironmentUrl(e.target.value)}
                  placeholder="https://homologacao.corporativo.com.br"
                  disabled={running}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="requirements" className="text-xs font-semibold">Requisitos (um por linha)</Label>
              <Textarea
                id="requirements"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder={"VIVO.SEGURA.AUT.01 - Autenticação MFA obrigatória\nVIVO.SEGURA.CRIP.02 - Tráfego TLS 1.2+\nVIVO.SEGURA.LOG.03 - Logs de auditoria centralizados"}
                rows={5}
                disabled={running}
              />
              <p className="text-xs text-gray-500">
                Recomenda-se seguir o padrão VIVO.SEGURA.* da base de requisitos SD v4.1.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Relatório de Segurança (evidência)</Label>
              <EvidenceUpload
                disabled={running}
                onUploaded={setEvidence}
                onCleared={() => setEvidence(null)}
              />
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
                  ? "Pronto para iniciar a análise."
                  : running
                    ? "Processando pipeline de QA..."
                    : "Preencha todos os campos e envie a evidência."}
              </p>
              <Button onClick={handleRun} disabled={!canRun} className="gap-2">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {running ? "Analisando..." : "Executar Análise"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {(running || streamState.partial || resultId || error) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" /> Console do Motor de IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(streamState.phase || streamState.message) && (
                <div className="flex items-center gap-2 text-sm">
                  {running ? (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  <span className="font-medium text-gray-800">
                    {streamState.phase ? PHASE_LABELS[streamState.phase] ?? streamState.message : streamState.message}
                  </span>
                </div>
              )}

              {streamState.partial && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Conformidade parcial</span>
                    <span className="text-2xl font-bold text-primary">
                      {typeof streamState.partial.compliancePercent === "number"
                        ? `${streamState.partial.compliancePercent.toFixed(1)}%`
                        : "..."}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.min(streamState.partial.compliancePercent ?? 0, 100)}%` }}
                    />
                  </div>
                  {streamState.partial.findings && streamState.partial.findings.length > 0 && (
                    <p className="text-xs text-gray-500">
                      {streamState.partial.findings.length} requisito(s) avaliado(s) até o momento.
                    </p>
                  )}
                </div>
              )}

              {resultId && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Análise concluída e evidência arquivada.</p>
                      <p className="text-xs text-gray-500">
                        O relatório original foi comprimido em GZIP, arquivado em qa-logs-archive e expurgado do bucket temporário.
                      </p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => router.push(`/security-qa/project/${resultId}`)} className="gap-1.5 shrink-0">
                    Abrir Dashboard <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
