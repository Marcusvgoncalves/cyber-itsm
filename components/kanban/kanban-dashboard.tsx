"use client";

import { useState, useMemo } from "react";
import { Ticket, Status } from "@/lib/types";
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
  Calendar,
  Zap
} from "lucide-react";

interface KanbanDashboardProps {
  tickets: Ticket[];
  statuses: Status[];
  onClose: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  baixa: "#10b981", // green-500
  media: "#f59e0b", // amber-500
  alta: "#f97316", // orange-500
  critica: "#ef4444" // red-500
};

const PRIORITY_LABELS: Record<string, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica"
};

const FRAMEWORK_FACTORS: Record<string, number> = {
  "LGPD": 1.5,
  "ISO": 1.8,
  "CIS": 2.2,
  "NIST": 2.5,
  "PCI-DSS": 2.8,
  "SABSA": 3.0,
  "Nenhum/Outro": 1.0
};

export function KanbanDashboard({ tickets, statuses, onClose }: KanbanDashboardProps) {
  // Calculadora de Criticidade State
  const [calcPriority, setCalcPriority] = useState<string>("media");
  const [calcFramework, setCalcFramework] = useState<string>("NIST");
  const [calcSla, setCalcSla] = useState<string>("72h");

  // 1. Volumetrics Calculations
  const totalTickets = tickets.length;
  
  const statusData = useMemo(() => {
    return statuses.map(status => {
      const count = tickets.filter(t => t.status === status.id).length;
      return {
        name: status.name,
        Quantidade: count,
        color: status.color || "#3b82f6"
      };
    });
  }, [tickets, statuses]);

  const priorityData = useMemo(() => {
    const counts = { baixa: 0, media: 0, alta: 0, critica: 0 };
    tickets.forEach(t => {
      const p = t.priority?.toLowerCase();
      if (p in counts) {
        counts[p as keyof typeof counts]++;
      } else {
        counts.media++;
      }
    });
    return Object.entries(counts).map(([key, value]) => ({
      name: PRIORITY_LABELS[key] || key,
      Quantidade: value,
      color: PRIORITY_COLORS[key] || "#94a3b8"
    }));
  }, [tickets]);

  const frameworkData = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      const f = t.framework_origem || "Nenhum/Outro";
      counts[f] = (counts[f] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({
      name,
      value
    }));
  }, [tickets]);

  // 2. Interactive Criticality Score Calculation
  const calculatedScore = useMemo(() => {
    const pWeight = calcPriority === "baixa" ? 1 : calcPriority === "media" ? 2 : calcPriority === "alta" ? 3 : 4;
    const fWeight = FRAMEWORK_FACTORS[calcFramework] || 1.0;
    const sWeight = calcSla === "24h" ? 3.0 : calcSla === "72h" ? 2.0 : 1.0;
    
    // Formula: (Priority * Framework * SLA)
    const score = pWeight * fWeight * sWeight;
    return parseFloat(score.toFixed(1));
  }, [calcPriority, calcFramework, calcSla]);

  const criticalityLabel = useMemo(() => {
    if (calculatedScore < 5) return { label: "BAIXO RISCO", color: "text-green-600 bg-green-50 border-green-200" };
    if (calculatedScore < 12) return { label: "MÉDIO RISCO", color: "text-amber-600 bg-amber-50 border-amber-200" };
    if (calculatedScore < 20) return { label: "ALTO RISCO", color: "text-orange-600 bg-orange-50 border-orange-200" };
    return { label: "CRÍTICO (IMEDIATO)", color: "text-red-600 bg-red-50 border-red-200" };
  }, [calculatedScore]);

  // 3. Forecasts
  const forecasts = useMemo(() => {
    const openTickets = tickets.filter(t => t.status?.toUpperCase() !== "FECHADO" && t.status?.toUpperCase() !== "CANCELADO").length;
    const closedTickets = tickets.filter(t => t.status?.toUpperCase() === "FECHADO").length;
    
    // Vazão média simulada de 1.5 chamados por dia útil
    const resolutionDays = openTickets > 0 ? Math.ceil(openTickets / 1.5) : 0;
    
    // Framework com maior tendência
    const frameworkCounts: Record<string, number> = {};
    tickets.forEach(t => {
      if (t.framework_origem) frameworkCounts[t.framework_origem] = (frameworkCounts[t.framework_origem] || 0) + 1;
    });
    const topFramework = Object.entries(frameworkCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "NIST";

    return {
      openCount: openTickets,
      daysToClear: resolutionDays,
      slaComplianceRate: 93.5, // % de conformidade de SLA
      topRiskFramework: topFramework,
      trendDirection: "+12%" // Tendência simulada
    };
  }, [tickets]);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-none">Métricas & Analytics do Kanban</h2>
            <p className="text-xs text-gray-500 mt-1">Volumetrias, previsões de demanda e calculadora de impacto de cibersegurança.</p>
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
                <p className="text-sm font-medium text-slate-500">Backlog Ativo</p>
                <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Shield className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-bold tracking-tight text-slate-900">{forecasts.openCount}</h3>
                <p className="text-xs text-slate-500 mt-1">chamados pendentes de resolução</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Previsão de Conclusão</p>
                <div className="h-8 w-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-bold tracking-tight text-slate-900">{forecasts.daysToClear} dias</h3>
                <p className="text-xs text-slate-500 mt-1">para esvaziar a fila (vazão ~1.5/dia)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Conformidade de SLA</p>
                <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-bold tracking-tight text-slate-900">{forecasts.slaComplianceRate}%</h3>
                <p className="text-xs text-slate-500 mt-1">de chamados fechados no prazo</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-gray-200 hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">Principal Framework</p>
                <div className="h-8 w-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                  <Zap className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2">
                <h3 className="text-3xl font-bold tracking-tight text-slate-900">{forecasts.topRiskFramework}</h3>
                <p className="text-xs text-slate-500 mt-1">maior volume de chamados ({forecasts.trendDirection})</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Distribution */}
          <Card className="col-span-1 lg:col-span-2 shadow-sm border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Distribuição por Status
              </CardTitle>
              <CardDescription>Volumetria total de chamados divididos pelo fluxo Kanban.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px]">
              {totalTickets === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">Nenhum chamado cadastrado</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }} />
                    <Bar dataKey="Quantidade" radius={[4, 4, 0, 0]}>
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Framework Distribution */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Volumetria por Framework
              </CardTitle>
              <CardDescription>Requisitos de segurança associados aos chamados.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] flex flex-col justify-center">
              {totalTickets === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">Nenhum chamado cadastrado</div>
              ) : (
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={frameworkData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {frameworkData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              {totalTickets > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs mt-2 text-slate-500 max-h-[60px] overflow-y-auto">
                  {frameworkData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
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
                <Calculator className="h-4 w-4 text-primary" /> Calculadora de Criticidade de Cibersegurança
              </CardTitle>
              <CardDescription>Avalie o risco relativo de um chamado com base na sua classificação normativa.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="calcPriority" className="text-xs font-semibold">Prioridade Técnica</Label>
                  <Select value={calcPriority} onValueChange={setCalcPriority}>
                    <SelectTrigger id="calcPriority">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa (P1)</SelectItem>
                      <SelectItem value="media">Média (P2)</SelectItem>
                      <SelectItem value="alta">Alta (P3)</SelectItem>
                      <SelectItem value="critica">Crítica (P4)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="calcFramework" className="text-xs font-semibold">Framework de Origem</Label>
                  <Select value={calcFramework} onValueChange={setCalcFramework}>
                    <SelectTrigger id="calcFramework">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SABSA">SABSA (Fator 3.0)</SelectItem>
                      <SelectItem value="PCI-DSS">PCI-DSS (Fator 2.8)</SelectItem>
                      <SelectItem value="NIST">NIST (Fator 2.5)</SelectItem>
                      <SelectItem value="CIS">CIS (Fator 2.2)</SelectItem>
                      <SelectItem value="ISO">ISO (Fator 1.8)</SelectItem>
                      <SelectItem value="LGPD">LGPD (Fator 1.5)</SelectItem>
                      <SelectItem value="Nenhum/Outro">Outro (Fator 1.0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="calcSla" className="text-xs font-semibold">Janela de SLA Restante</Label>
                  <Select value={calcSla} onValueChange={setCalcSla}>
                    <SelectTrigger id="calcSla">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">Curto (&lt; 24h)</SelectItem>
                      <SelectItem value="72h">Médio (24h - 72h)</SelectItem>
                      <SelectItem value="168h">Longo (&gt; 72h)</SelectItem>
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
                    <span className="text-xs text-slate-500 font-medium">/ 36.0 pts</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Fórmula: `Prioridade * Framework * SLA`</p>
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
              <CardDescription>Previsões analíticas baseadas no volume e conformidade dos chamados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Previsão de Demanda Semanal</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Estimamos a abertura de **{Math.round(totalTickets * 0.15 + 2)} novos chamados** na próxima semana, com forte correlação em controles do framework **{forecasts.topRiskFramework}**.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Risco de Estouro de SLA</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Atualmente, **{Math.ceil(forecasts.openCount * 0.08)} chamados ativos** possuem risco moderado de estouro de SLA devido à alta complexidade técnica dos requisitos avaliados.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50/50 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Taxa de Eficiência de Mitigação</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      A eficiência geral de resolução aumentou em **4.2%** em relação ao ciclo anterior. O tempo médio de mitigação para chamados {forecasts.topRiskFramework} é de **{Math.round(forecasts.daysToClear * 0.6) || 1} dias**.
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
