"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceUpload, type UploadedEvidence } from "@/components/security-qa/evidence-upload";
import { useQaResult } from "@/lib/security-qa/use-qa-result";
import { Play, Loader2, CheckCircle2, XCircle, ChevronRight, Bot, FileDown, Hourglass } from "lucide-react";

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

export default function AssessPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [environmentUrl, setEnvironmentUrl] = useState("");
  const [requirements, setRequirements] = useState("");
  const [evidence, setEvidence] = useState<UploadedEvidence | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Realtime: PROCESSANDO -> CONCLUIDO/FALHA via Supabase Realtime.
  const { phase, completion, error: realtimeError } = useQaResult(resultId);

  const running = submitting || phase === "processing";
  const error = submitError ?? realtimeError;
  const done = phase === "done" && completion !== null;

  const canRun =
    projectName.trim().length > 0 &&
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
          projectName: projectName.trim(),
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
  }, [evidence, projectName, environmentUrl, requirements]);

  return (
    <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Nova Avaliação de Segurança</h1>
          <p className="text-sm text-gray-600 mt-1">
            Envie o relatório de segurança e os requisitos. O motor cruza tudo em background (multiagente via Inngest);
            o resultado chega automaticamente por WebSocket e o laudo em PDF é gerado e arquivado no storage.
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
                placeholder={"CYBER.SEGURA.AUT.01 - Autenticação MFA obrigatória\nCYBER.SEGURA.CRIP.02 - Tráfego TLS 1.2+\nCYBER.SEGURA.LOG.03 - Logs de auditoria centralizados"}
                rows={5}
                disabled={running}
              />
              <p className="text-xs text-gray-500">
                Recomenda-se seguir o padrão CYBER.SEGURA.* da base de requisitos SD v4.1.
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
                  ? "Pronto para iniciar a análise em background."
                  : running
                    ? "Processando Análise em Background..."
                    : "Preencha todos os campos e envie a evidência."}
              </p>
              <Button onClick={handleRun} disabled={!canRun} className="gap-2">
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {running ? "Processando..." : "Executar Análise"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {running && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Hourglass className="h-5 w-5 text-primary animate-pulse" /> Security QA em Background
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-gray-800">Processando Análise em Background...</p>
              <p className="text-xs text-gray-500 mt-1">
                Os agentes de IA (Groq/OpenRouter/Gemini) estão cruzando os requisitos com a evidência.
                O score e o PDF aparecerão automaticamente assim que o worker concluir (Supabase Realtime).
              </p>
            </CardContent>
          </Card>
        )}

        {done && completion && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" /> Resultado do Motor de IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <p className="text-sm font-semibold text-gray-900">
                  Análise concluída em background e evidência arquivada.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Score de Conformidade</p>
                  <p className="text-2xl font-bold text-primary">
                    {completion.compliancePercent !== null ? `${completion.compliancePercent.toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Classificação de Risco</p>
                  <p className={`text-2xl font-bold ${completion.overallRating ? RATING_COLOR[completion.overallRating] ?? "" : ""}`}>
                    {completion.overallRating ? (RATING_LABEL[completion.overallRating] ?? completion.overallRating) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
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
                  Abrir Dashboard <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
  );
}
