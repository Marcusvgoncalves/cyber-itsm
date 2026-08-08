"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { QaResult, QaFindingStatus } from "@/lib/security-qa/types";
import type { User } from "@/lib/types";
import { deleteQaAnalysis } from "@/app/actions/security-qa";
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import {
  Download,
  FileDown,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Archive,
  FileText,
  Link2,
  Trash2,
} from "lucide-react";

interface ProjectDashboardProps {
  result: QaResult;
  evidenceUrl: string | null;
  currentUser: User;
}

const RATING_META: Record<string, { label: string; color: string; bg: string }> = {
  baixo: { label: "Baixo", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  medio: { label: "Médio", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  alto: { label: "Alto", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  critico: { label: "Crítico", color: "text-red-700", bg: "bg-red-50 border-red-200" },
};

const FINDING_META: Record<QaFindingStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  conforme: { label: "Conforme", color: "#1a9e5c", icon: CheckCircle2 },
  parcial: { label: "Parcial", color: "#FF9900", icon: AlertTriangle },
  nao_conforme: { label: "Não conforme", color: "#ef4444", icon: XCircle },
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function ProjectDashboard({ result, evidenceUrl, currentUser }: ProjectDashboardProps) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const rating = RATING_META[result.overall_rating] ?? RATING_META.medio;
  const isAdmin = currentUser.role === "admin";

  const counts = {
    conforme: result.findings.filter((f) => f.status === "conforme").length,
    parcial: result.findings.filter((f) => f.status === "parcial").length,
    nao_conforme: result.findings.filter((f) => f.status === "nao_conforme").length,
  };

  const barData = (Object.keys(FINDING_META) as QaFindingStatus[]).map((status) => ({
    name: FINDING_META[status].label,
    qtd: counts[status],
    color: FINDING_META[status].color,
  }));

  const gaugeData = [{ name: "Conformidade", value: Number(result.compliance_percent) }];

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const [{ pdf }, { QaReportDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/security-qa/pdf-report"),
      ]);
      const blob = await pdf(<QaReportDocument result={result} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `security-qa-${result.project_name.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.error("Erro ao exportar PDF:", err);
    } finally {
      setExporting(false);
    }
  }, [result]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(
      `Excluir definitivamente a análise de "${result.project_name}"? ` +
      "Os artefatos forenses (GZIP) e o laudo PDF serão removidos do Storage. Esta ação não pode ser desfeita."
    )) return;

    setDeleting(true);
    try {
      const res = await deleteQaAnalysis(result.id);
      if (res.ok) {
        router.push("/security-qa");
      } else {
        window.alert(res.error ?? "Falha ao excluir a análise.");
      }
    } catch (err) {
      console.error("Erro ao excluir análise:", err);
      window.alert("Falha ao excluir a análise.");
    } finally {
      setDeleting(false);
    }
  }, [result.id, result.project_name, router]);

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Cabeçalho do resultado */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{result.project_name}</h1>
            <p className="text-sm text-gray-600 mt-1 flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" /> {result.environment_url}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Avaliado em {new Date(result.created_at).toLocaleString("pt-BR")} · {result.original_file_name}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:items-center">
            <div className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 ${rating.bg}`}>
              <ShieldAlert className={`h-5 w-5 ${rating.color}`} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Classificação de Risco</p>
                <p className={`text-lg font-bold leading-tight ${rating.color}`}>{rating.label}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting} className="gap-1.5">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              Exportar PDF
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
                className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                title="Excluir análise (somente ADMIN)"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir
              </Button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Conformidade</p>
              <p className="text-3xl font-bold text-primary mt-1">{Number(result.compliance_percent).toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Requisitos Avaliados</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{result.findings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Evidência Original</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{formatBytes(result.original_size_bytes)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Arquivo Forense (GZIP)</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{formatBytes(result.archived_size_bytes)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {result.compression_ratio != null ? `economia de ${((1 - result.compression_ratio) * 100).toFixed(0)}%` : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Índice de Conformidade</CardTitle>
              <CardDescription>Percentual geral cruzado pelo motor de IA</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="72%"
                    outerRadius="100%"
                    barSize={18}
                    data={gaugeData}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar dataKey="value" angleAxisId={0} background cornerRadius={10} fill="#660099" />
                    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-gray-900">
                      <tspan x="50%" dy="-8" className="text-3xl font-bold fill-primary">
                        {Number(result.compliance_percent).toFixed(1)}%
                      </tspan>
                      <tspan x="50%" dy="18" className="text-xs fill-gray-400">
                        conformidade
                      </tspan>
                    </text>
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4">
                {(Object.keys(FINDING_META) as QaFindingStatus[]).map((status) => {
                  const meta = FINDING_META[status];
                  const Icon = meta.icon;
                  return (
                    <div key={status} className="flex flex-col items-center rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                      <Icon className="h-4 w-4 mb-1" style={{ color: meta.color }} />
                      <span className="text-lg font-bold text-gray-900">{counts[status]}</span>
                      <span className="text-[10px] font-semibold text-gray-500 text-center">{meta.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Vereditos por Requisito</CardTitle>
              <CardDescription>Distribuição dos status atribuídos pelo motor de IA</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#737373" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#737373" }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "#fafafa" }} />
                    <Bar dataKey="qtd" name="Requisitos" radius={[6, 6, 0, 0]} maxBarSize={64}>
                      {barData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sumário executivo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Sumário Executivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 leading-relaxed">{result.executive_summary}</p>
          </CardContent>
        </Card>

        {/* Requisitos avaliados */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Análise por Requisito</CardTitle>
            <CardDescription>Vulnerabilidades cruzadas com os requisitos de arquitetura segura</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 font-bold">
                  <tr>
                    <th scope="col" className="px-4 py-3">Requisito</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Evidência</th>
                    <th scope="col" className="px-4 py-3">Recomendação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.findings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-gray-400">Nenhum requisito avaliado.</td>
                    </tr>
                  ) : (
                    result.findings.map((f, i) => {
                      const meta = FINDING_META[f.status];
                      const Icon = meta.icon;
                      return (
                        <tr key={`${f.requirementId}-${i}`} className="bg-white hover:bg-gray-50 align-top">
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs font-bold text-primary">{f.requirementId}</p>
                            <p className="font-semibold text-gray-900">{f.requirementName}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold border"
                              style={{ color: meta.color, backgroundColor: `${meta.color}14`, borderColor: `${meta.color}40` }}
                            >
                              <Icon className="h-3 w-3" /> {meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">{f.evidence}</td>
                          <td className="px-4 py-3 text-xs">{f.recommendation}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Evidência arquivada */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Archive className="h-5 w-5 text-primary" /> Evidência Forense Arquivada
            </CardTitle>
            <CardDescription>
              Política de compressão e retenção (cold storage) — o relatório original é preservado em GZIP.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-500">Bucket temporário (expurgado)</p>
                  <p className="font-mono text-xs text-gray-800">qa-temp-evidences</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-500">Bucket de arquivamento</p>
                  <p className="font-mono text-xs text-gray-800">qa-logs-archive</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-500">Objeto arquivado</p>
                  <p className="font-mono text-xs text-gray-800 break-all">{result.archived_file_path}</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-200 pt-3">
                <p className="text-xs text-gray-500">
                  Tamanho original: <strong>{formatBytes(result.original_size_bytes)}</strong> → comprimido:{" "}
                  <strong>{formatBytes(result.archived_size_bytes)}</strong> (GZIP). O arquivo bruto já foi purgado do bucket
                  temporário.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {evidenceUrl && (
                    <a href={evidenceUrl} target="_blank" rel="noopener noreferrer" download>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Download className="h-4 w-4" /> Baixar evidência .gz
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
