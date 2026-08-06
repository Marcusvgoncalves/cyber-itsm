import Link from "next/link";
import { listQaResults } from "@/lib/security-qa/qaRepository";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  PlusCircle,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileArchive,
} from "lucide-react";
import type { QaFindingStatus, QaResult } from "@/lib/security-qa/types";

export const metadata = {
  title: "Centro de Security QA",
  description: "Ingestão de relatórios de segurança, cruzamento com requisitos via IA e arquivamento forense",
};

const RATING_LABEL: Record<string, string> = { baixo: "Baixo", medio: "Médio", alto: "Alto", critico: "Crítico" };
const RATING_BADGE: Record<string, string> = {
  baixo: "bg-green-50 text-green-700 border-green-200",
  medio: "bg-amber-50 text-amber-700 border-amber-200",
  alto: "bg-orange-50 text-orange-700 border-orange-200",
  critico: "bg-red-50 text-red-700 border-red-200",
};

function statusCounts(result: QaResult) {
  const counts: Record<QaFindingStatus, number> = { conforme: 0, parcial: 0, nao_conforme: 0 };
  result.findings.forEach((f) => {
    if (counts[f.status] !== undefined) counts[f.status] += 1;
  });
  return counts;
}

export default async function SecurityQaHomePage() {
  const results = await listQaResults(50).catch(() => []);

  return (
    <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Avaliações de Segurança</h1>
            <p className="text-sm text-gray-600 mt-1">
              Ingestão de relatórios, cruzamento com requisitos via IA (Gemini) e arquivamento forense comprimido em GZIP.
            </p>
          </div>
          <Link href="/security-qa/assess">
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" /> Nova Avaliação
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 font-bold">
                  <tr>
                    <th scope="col" className="px-4 py-3">Projeto</th>
                    <th scope="col" className="px-4 py-3">Conformidade</th>
                    <th scope="col" className="px-4 py-3">Risco</th>
                    <th scope="col" className="px-4 py-3">Vereditos</th>
                    <th scope="col" className="px-4 py-3">Evidência</th>
                    <th scope="col" className="px-4 py-3">Data</th>
                    <th scope="col" className="px-4 py-3 text-right">Abrir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10">
                        <p className="text-gray-400">Nenhuma avaliação realizada ainda.</p>
                        <Link href="/security-qa/assess">
                          <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                            <PlusCircle className="h-4 w-4" /> Iniciar primeira avaliação
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    results.map((result) => {
                      const badge = RATING_BADGE[result.overall_rating] ?? RATING_BADGE.medio;
                      const counts = statusCounts(result);
                      return (
                        <tr key={result.id} className="bg-white hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-900">{result.project_name}</p>
                            <p className="font-mono text-[10px] text-gray-400">{result.environment_url}</p>
                          </td>
                          <td className="px-4 py-3 font-bold text-primary">
                            {Number(result.compliance_percent).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge}`}>
                              {RATING_LABEL[result.overall_rating] ?? result.overall_rating}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 text-[11px]">
                              <span className="inline-flex items-center gap-1 text-green-700">
                                <CheckCircle2 className="h-3 w-3" /> {counts.conforme}
                              </span>
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <AlertTriangle className="h-3 w-3" /> {counts.parcial}
                              </span>
                              <span className="inline-flex items-center gap-1 text-red-700">
                                <XCircle className="h-3 w-3" /> {counts.nao_conforme}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                              <FileArchive className="h-3.5 w-3.5" />
                              {result.compression_ratio != null ? `${((1 - result.compression_ratio) * 100).toFixed(0)}% menor` : "GZIP"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {new Date(result.created_at).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/security-qa/project/${result.id}`} className="inline-flex">
                              <Button variant="ghost" size="sm" className="text-primary gap-1">
                                Dashboard <ChevronRight className="h-4 w-4" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}
