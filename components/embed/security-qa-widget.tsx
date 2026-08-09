'use client';

import type { QaFindingStatus, QaResult } from '@/lib/security-qa/types';
import { CheckCircle2, AlertTriangle, XCircle, ShieldAlert } from 'lucide-react';
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';

interface SecurityQaWidgetProps {
  result: QaResult;
}

const RATING_META: Record<string, { label: string; color: string; bg: string }> = {
  baixo: { label: 'Baixo', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  medio: { label: 'Médio', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  alto: { label: 'Alto', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  critico: { label: 'Crítico', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

const FINDING_META: Record<QaFindingStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  conforme: { label: 'Conforme', color: '#1a9e5c', icon: CheckCircle2 },
  parcial: { label: 'Parcial', color: '#FF9900', icon: AlertTriangle },
  nao_conforme: { label: 'Não conforme', color: '#ef4444', icon: XCircle },
};

function statusCounts(result: QaResult) {
  const counts: Record<QaFindingStatus, number> = { conforme: 0, parcial: 0, nao_conforme: 0 };
  result.findings.forEach((f) => {
    if (counts[f.status] !== undefined) counts[f.status] += 1;
  });
  return counts;
}

/**
 * Widget visual isolado (sem AppShell/sidebar) para embutir via iframe.
 * Consumido apenas por /embed/security-qa/[id] — Componente de UI pura.
 */
export function SecurityQaWidget({ result }: SecurityQaWidgetProps) {
  const rating = RATING_META[result.overall_rating] || RATING_META.medio;
  const counts = statusCounts(result);
  const compliance = result.compliance_percent ?? 0;

  const fillColor =
    result.overall_rating === 'baixo'
      ? '#1a9e5c'
      : result.overall_rating === 'critico'
        ? '#ef4444'
        : result.overall_rating === 'alto'
          ? '#f97316'
          : '#f59e0b';
  const gaugeData = [{ name: 'Conformidade', value: compliance, fill: fillColor }];

  return (
    <div className="w-full max-w-3xl mx-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Cabeçalho compacto */}
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Security QA · Embed
          </p>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{result.project_name}</h2>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{result.environment_url}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${rating.bg}`}
        >
          <ShieldAlert className={`h-3.5 w-3.5 ${rating.color}`} />
          <span className={`text-xs font-bold ${rating.color}`}>Risco {rating.label}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-6 px-5 py-6">
        {/* Gauge de conformidade */}
        <div className="flex flex-col items-center">
          <div className="relative h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                data={gaugeData}
                startAngle={225}
                endAngle={-45}
                innerRadius="70%"
                outerRadius="100%"
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar dataKey="value" angleAxisId={0} cornerRadius={12} fill={fillColor} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-gray-900">{Math.round(compliance)}%</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                Conformidade
              </span>
            </div>
          </div>
        </div>

        {/* Resumo dos achados */}
        <div className="space-y-3">
          <p className="text-sm text-gray-600 line-clamp-4">
            {result.executive_summary || 'Nenhum resumo executivo disponível.'}
          </p>
          <div className="space-y-2">
            {(Object.keys(FINDING_META) as QaFindingStatus[]).map((status) => {
              const meta = FINDING_META[status];
              const Icon = meta.icon;
              return (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Icon className="h-4 w-4" style={{ color: meta.color }} />
                    {meta.label}
                  </span>
                  <span className="text-sm font-bold" style={{ color: meta.color }}>
                    {counts[status]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
