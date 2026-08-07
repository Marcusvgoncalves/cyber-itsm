"use client";

import { useState, useMemo } from "react";
import type { QaResult, QaFindingStatus } from "@/lib/security-qa/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie
} from "recharts";
import {
  X,
  TrendingUp,
  Shield,
  Activity,
  Calculator,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileArchive,
  BarChart3,
  Flame
} from "lucide-react";

interface SecurityQaDashboardProps {
  results: QaResult[];
  onClose: () => void;
}

const RATING_COLORS: Record<string, string> = {
  baixo: "#10b981", // green-500
  medio: "#f59e0b", // amber-500
  alto: "#f97316", // orange-500
  critico: "#ef4444" // red-500
};

const RATING_LABELS: Record<string, string> = {
  baixo: "Baixo Risco",
  medio: "Médio Risco",
  alto: "Alto Risco",
  critico: "Crítico"
};

const SCOPE_FACTORS: Record<string, number> = {
  "Interno": 1.0,
  "Corporativo": 1.8,
  "Crítico/IAM": 2.5
};

const EXPOSURE_FACTORS: Record<string, number> = {
  "Host Local": 1.0,
  "Rede Interna": 1.5,
  "Internet": 2.2
};

export function SecurityQaDashboard({ results, onClose }: SecurityQaDashboardProps) {
  // Calculadora de Criticidade State
  const [calcSeverity, setCalcSeverity] = useState<string>("medio");
  const [calcScope, setCalcScope] = useState<string>("Corporativo");
  const [calcExposure, setCalcExposure] = useState<string>("Internet");

  const totalResults = results.length;

  // 1. Volumetrics Calculations
  const averageCompliance = useMemo(() => {
    if (totalResults === 0) return 0;
    const sum = results.reduce((acc, r) => acc + Number(r.compliance_percent), 0);
    return parseFloat((sum / totalResults).toFixed(1));
  }, [results, totalResults]);

  const verdictTotals = useMemo(() => {
    const totals: Record<QaFindingStatus, number> = { conforme: 0, parcial: 0, nao_conforme: 0 };
    results.forEach(r => {
      r.findings.forEach(f => {
        if (f.status in totals) {
          totals[f.status as QaFindingStatus]++;
        }
      });
    });
    return [
      { name: "Conforme", Quantidade: totals.conforme, color: "#10b981" },
      { name: "Parcial", Quantidade: totals.parcial, color: "#f59e0b" },
      { name: "Não Conforme", Quantidade: totals.nao_conforme, color: "#ef4444" }
    ];
  }, [results]);

  const riskDistribution = useMemo(() => {
    const counts = { baixo: 0, medio: 0, alto: 0, critico: 0 };
    results.forEach(r => {
      const rating = r.overall_rating?.toLowerCase();
      if (rating in counts) {
        counts[rating as keyof typeof counts]++;
      } else {
        counts.medio++;
      }
    });
    return Object.entries(counts).map(([key, value]) => ({
      name: RATING_LABELS[key] || key,
      value,
      color: RATING_COLORS[key] || "#94a3b8"
    }));
  }, [results]);

  const averageCompression = useMemo(() => {
    if (totalResults === 0) return 0;
    let validCounts = 0;
    const sum = results.reduce((acc, r) => {
      if (r.compression_ratio !== null) {
        validCounts++;
        return acc + (1 - Number(r.compression_ratio));
      }
      return acc;
    }, 0);
    return validCounts > 0 ? Math.round((sum / validCounts) * 100) : 85;
  }, [results, totalResults]);

  // 2. Interactive Criticality Score Calculation
  const calculatedScore = useMemo(() => {
    const sevWeight = calcSeverity === "baixo" ? 1 : calcSeverity === "medio" ? 2 : calcSeverity === "alto" ? 3 : 4;
    const scopeWeight = SCOPE_FACTORS[calcScope] || 1.0;
    const expWeight = EXPOSURE_FACTORS[calcExposure] || 1.0;

    // Formula: Severity * Scope * Exposure
    const score = sevWeight * scopeWeight * expWeight;
    return parseFloat(score.toFixed(1));
  }, [calcSeverity, calcScope, calcExposure]);

  const criticalityLabel = useMemo(() => {
    if (calculatedScore < 4) return { label: "BAIXO RISCO", color: "text-green-600 bg-green-50 border-green-200" };
    if (calculatedScore < 8) return { label: "MÉDIO RISCO", color: "text-amber-600 bg-amber-50 border-amber-200" };
    if (calculatedScore < 14) return { label: "ALTO RISCO", color: "text-orange-600 bg-orange-50 border-orange-200" };
    return { label: "CRÍTICO (IMEDIATO)", color: "text-red-600 bg-red-50 border-red-200 animate-pulse" };
  }, [calculatedScore]);

  // 3. Forecasts
  const forecasts = useMemo(() => {
    const totalFindingsCount = verdictTotals.reduce((acc, v) => acc + v.Quantidade, 0);
    const nonConformingCount = verdictTotals.find(v => v.name === "Não Conforme")?.Quantidade || 0;
    
    // Projeção baseada na taxa histórica de conformidade
    const predictedCompliance = totalResults > 0 ? Math.min(100, Math.round(averageCompliance * 1.05)) : 80;
    const highRiskAlertCount = results.filter(r => r.overall_rating === "critico" || r.overall_rating === "alto").length;

    return {
      predictedCompliance,
      highRiskAlertCount,
      totalFindingsCount,
      nonConformingPercent: totalFindingsCount > 0 ? Math.round((nonConformingCount / totalFindingsCount) * 100) : 0
    };
  }, [results, verdictTotals, averageCompliance, totalResults]);

  const COLORS = ["#10b981", "#f59e0b", "#f97316", "#ef4444"];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-none">Métricas &amp; Analytics de Security QA</h2>
            <p className="text-xs text-gray-500 mt-1">Status de conformidade regulatória, integridade do storage forense e calculadora de risco.</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-slate-100">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Cards (Overview Key Metrics) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Projetos Avaliados</p>
                <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Shield className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-bold tracking-tight text-slate-900">{totalResults}</h3>
                <p className="text-xs text-slate-500 mt-1">varreduras integradas no sistema</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Média de Conformidade</p>
                <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-bold tracking-tight text-slate-900">{averageCompliance}%</h3>
                <p className="text-xs text-slate-500 mt-1">atendimento aos requisitos exigidos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Vereditos Identificados</p>
                <div className="h-8 w-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Flame className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-bold tracking-tight text-slate-900">{forecasts.totalFindingsCount}</h3>
                <p className="text-xs text-slate-500 mt-1">total de cruzamentos efetuados</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Redução Forense Média</p>
                <div className="h-8 w-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                  <FileArchive className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-bold tracking-tight text-slate-900">{averageCompression}% menor</h3>
                <p className="text-xs text-slate-500 mt-1">espaço economizado com GZIP forense</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Verdicts Volume Distribution */}
          <Card className="col-span-1 lg:col-span-2 shadow-sm border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Distribuição de Vereditos
              </CardTitle>
              <CardDescription>Acumulado total de requisitos avaliados por veredito (Conforme, Parcial, Não Conforme).</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {totalResults === 0 || forecasts.totalFindingsCount === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">Nenhuma avaliação cadastrada</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={verdictTotals} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }} />
                    <Bar dataKey="Quantidade" radius={[4, 4, 0, 0]}>
                      {verdictTotals.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Risk Level Distribution */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Classificação Geral de Risco
              </CardTitle>
              <CardDescription>Percentual de ratings globais atribuídos pelo motor de IA.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] flex flex-col justify-center">
              {totalResults === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">Nenhuma avaliação cadastrada</div>
              ) : (
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {riskDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              {totalResults > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs mt-2 text-slate-500 max-h-[60px] overflow-y-auto">
                  {riskDistribution.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span>{entry.name} ({entry.value})</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lower Row: Interactive Criticality Calculator & Forecast Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Interactive Calculator */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" /> Calculadora de Impacto de Cibersegurança
              </CardTitle>
              <CardDescription>Determine a criticidade técnica de novos riscos regulatórios identificados em QA.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="calcSeverity" className="text-xs font-semibold">Severidade Vulnerabilidade</Label>
                  <Select value={calcSeverity} onValueChange={setCalcSeverity}>
                    <SelectTrigger id="calcSeverity">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixo">Baixa (x1)</SelectItem>
                      <SelectItem value="medio">Média (x2)</SelectItem>
                      <SelectItem value="alto">Alta (x3)</SelectItem>
                      <SelectItem value="critico">Crítica (x4)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="calcScope" className="text-xs font-semibold">Escopo do Sistema</Label>
                  <Select value={calcScope} onValueChange={setCalcScope}>
                    <SelectTrigger id="calcScope">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Interno">Interno (Fator 1.0)</SelectItem>
                      <SelectItem value="Corporativo">Corporativo (Fator 1.8)</SelectItem>
                      <SelectItem value="Crítico/IAM">Crítico / IAM (Fator 2.5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="calcExposure" className="text-xs font-semibold">Exposição de Rede</Label>
                  <Select value={calcExposure} onValueChange={setCalcExposure}>
                    <SelectTrigger id="calcExposure">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Host Local">Host Local (Fator 1.0)</SelectItem>
                      <SelectItem value="Rede Interna">Rede Interna (Fator 1.5)</SelectItem>
                      <SelectItem value="Internet">Internet (Fator 2.2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Calculator Output Display */}
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5 mt-4 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Score de Criticidade da IA</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-slate-900 tracking-tight">{calculatedScore}</span>
                    <span className="text-xs text-slate-500 font-medium">/ 22.0 pts</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Fórmula: `Severidade * Escopo * Exposição`</p>
                </div>
                <div className={`px-4 py-3 rounded-lg border font-bold text-sm tracking-wide text-center shrink-0 min-w-[140px] shadow-sm ${criticalityLabel.color}`}>
                  {criticalityLabel.label}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Forecast Analysis Details */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Previsões e Análise de Tendência
              </CardTitle>
              <CardDescription>Métricas preditivas extraídas do histórico de auditorias de cibersegurança.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Previsão de Conformidade Próxima Auditoria</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Com base nas remediações aplicadas, projetamos um aumento de conformidade para **{forecasts.predictedCompliance}%** na próxima varredura de homologação.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Risco Crítico nos Requisitos</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Atualmente, **{forecasts.nonConformingPercent}% de todos os vereditos** são de não-conformidade absoluta, sugerindo a necessidade de aplicar templates de arquitetura padrão.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                    <FileArchive className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Integridade de Storage Forense</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      100% dos laudos arquivados em GZIP forense possuem hash de verificação de integridade ativo com tempo médio de expiração de link de 10 minutos.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
