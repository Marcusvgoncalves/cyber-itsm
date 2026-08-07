"use client";

import { useState, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileCheck,
  Zap,
  Tag,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import requisitosData from "@/requisitos-sd.json";

export interface RequisitoItem {
  id: string | null;
  controle: string | null;
  detalhamento: string | null;
  componente: string | null;
  propriedade: string | null;
  strideLM: string | null;
  riscos: string | null;
  owasp: string | null;
  categoria: string | null;
  criticidade: string | null;
  tipoControle: string | null;
  evidencia: string | null;
  comoTestar: string | null;
}

const ITEMS_PER_PAGE = 12;

export function InteractiveRequirementsCatalog() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCriticality, setSelectedCriticality] = useState<string>("TODOS");
  const [selectedComponent, setSelectedComponent] = useState<string>("TODOS");
  const [selectedStride, setSelectedStride] = useState<string>("TODOS");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const requisitosList = useMemo(() => {
    return (requisitosData as unknown as RequisitoItem[]);
  }, []);

  // Extrai listas únicas para os filtros
  const componentsList = useMemo(() => {
    const set = new Set<string>();
    requisitosList.forEach((r) => {
      if (r.componente) set.add(r.componente);
    });
    return Array.from(set).sort();
  }, [requisitosList]);

  const strideList = useMemo(() => {
    const set = new Set<string>();
    requisitosList.forEach((r) => {
      if (r.strideLM) set.add(r.strideLM);
    });
    return Array.from(set).sort();
  }, [requisitosList]);

  // Estatísticas agregadas
  const stats = useMemo(() => {
    let critico = 0;
    let alto = 0;
    let moderado = 0;
    let baixo = 0;

    requisitosList.forEach((r) => {
      const c = (r.criticidade || "").toLowerCase();
      if (c.includes("crítico") || c.includes("critico")) critico++;
      else if (c.includes("alto")) alto++;
      else if (c.includes("moderado") || c.includes("médio") || c.includes("medio")) moderado++;
      else if (c.includes("baixo")) baixo++;
    });

    return { total: requisitosList.length, critico, alto, moderado, baixo };
  }, [requisitosList]);

  // Filtragem
  const filteredRequisitos = useMemo(() => {
    return requisitosList.filter((req) => {
      // Filtro de Criticidade
      if (selectedCriticality !== "TODOS") {
        const c = (req.criticidade || "").toLowerCase();
        const sel = selectedCriticality.toLowerCase();
        if (!c.includes(sel)) return false;
      }

      // Filtro de Componente
      if (selectedComponent !== "TODOS" && req.componente !== selectedComponent) {
        return false;
      }

      // Filtro de STRIDE
      if (selectedStride !== "TODOS" && req.strideLM !== selectedStride) {
        return false;
      }

      // Termo de Busca
      if (searchTerm.trim() !== "") {
        const query = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const searchable = [
          req.id,
          req.controle,
          req.detalhamento,
          req.componente,
          req.owasp,
          req.strideLM,
          req.categoria,
          req.riscos,
          req.evidencia,
          req.comoTestar,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");

        if (!searchable.includes(query)) return false;
      }

      return true;
    });
  }, [requisitosList, selectedCriticality, selectedComponent, selectedStride, searchTerm]);

  // Paginação
  const totalPages = Math.ceil(filteredRequisitos.length / ITEMS_PER_PAGE) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRequisitos.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRequisitos, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 600, behavior: "smooth" });
    }
  };

  const getCriticalityBadge = (crit: string | null) => {
    const c = (crit || "").toLowerCase();
    if (c.includes("crítico") || c.includes("critico")) {
      return <Badge className="bg-red-100 text-red-700 border-red-300 font-semibold">Crítico</Badge>;
    }
    if (c.includes("alto")) {
      return <Badge className="bg-orange-100 text-orange-700 border-orange-300 font-semibold">Alto</Badge>;
    }
    if (c.includes("moderado") || c.includes("médio") || c.includes("medio")) {
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 font-semibold">Moderado</Badge>;
    }
    return <Badge className="bg-blue-100 text-blue-700 border-blue-300 font-semibold">Baixo</Badge>;
  };

  return (
    <section className="mx-auto max-w-5xl px-6 py-10" id="base-requisitos-314">
      {/* Header da Seção */}
      <div className="mb-8 border-b border-gray-200 pb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
              <ShieldCheck className="h-4 w-4" />
              Catálogo Oficial SD v4.1
            </div>
            <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Base de Requisitos de Segurança ({stats.total} Itens)
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Consulte e pesquise interativamente todos os 314 requisitos de segurança de arquitetura e desenvolvimento.
            </p>
          </div>
        </div>

        {/* Cards de Volumetria por Criticidade */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm text-center">
            <span className="text-xs font-semibold uppercase text-gray-500">Total</span>
            <p className="mt-1 text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-3.5 shadow-sm text-center">
            <span className="text-xs font-semibold uppercase text-red-600">Críticos</span>
            <p className="mt-1 text-2xl font-bold text-red-700">{stats.critico}</p>
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3.5 shadow-sm text-center">
            <span className="text-xs font-semibold uppercase text-orange-600">Altos</span>
            <p className="mt-1 text-2xl font-bold text-orange-700">{stats.alto}</p>
          </div>
          <div className="rounded-xl border border-yellow-200 bg-yellow-50/50 p-3.5 shadow-sm text-center">
            <span className="text-xs font-semibold uppercase text-yellow-700">Moderados</span>
            <p className="mt-1 text-2xl font-bold text-yellow-800">{stats.moderado}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 shadow-sm text-center col-span-2 sm:col-span-1">
            <span className="text-xs font-semibold uppercase text-blue-600">Baixos</span>
            <p className="mt-1 text-2xl font-bold text-blue-700">{stats.baixo}</p>
          </div>
        </div>
      </div>

      {/* Painel de Filtros e Busca */}
      <Card className="mb-6 border-gray-200 shadow-sm bg-white">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            {/* Campo de Busca Principal */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar por ID (ex: VIVO.SEGURA.APIS.001), controle, OWASP, STRIDE ou palavra-chave..."
                className="h-11 rounded-lg border-gray-300 pl-10 text-sm shadow-sm focus:border-primary focus:ring-primary"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Selects de Filtro */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Filtro por Criticidade */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">Criticidade</label>
                <select
                  value={selectedCriticality}
                  onChange={(e) => {
                    setSelectedCriticality(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="TODOS">Todas as Criticidades</option>
                  <option value="Crítico">Crítico</option>
                  <option value="Alto">Alto</option>
                  <option value="Moderado">Moderado</option>
                  <option value="Baixo">Baixo</option>
                </select>
              </div>

              {/* Filtro por Componente */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">Componente</label>
                <select
                  value={selectedComponent}
                  onChange={(e) => {
                    setSelectedComponent(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="TODOS">Todos os Componentes</option>
                  {componentsList.map((comp) => (
                    <option key={comp} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por STRIDE */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">Modelo STRIDE</label>
                <select
                  value={selectedStride}
                  onChange={(e) => {
                    setSelectedStride(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="TODOS">Todas as Ameaças STRIDE</option>
                  {strideList.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contador de Resultados */}
      <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
        <span>
          Exibindo <strong>{paginatedItems.length}</strong> de <strong>{filteredRequisitos.length}</strong> requisitos filtrados
        </span>
        <span>
          Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
        </span>
      </div>

      {/* Grid de Requisitos */}
      {paginatedItems.length > 0 ? (
        <div className="space-y-3">
          {paginatedItems.map((req, idx) => {
            const reqKey = req.id || `req-${idx}`;
            const isExpanded = expandedId === reqKey;

            return (
              <Card
                key={reqKey}
                className={`transition-all duration-200 border-gray-200 hover:border-primary/40 hover:shadow-md ${
                  isExpanded ? "ring-2 ring-primary/20 bg-primary-light/10" : "bg-white"
                }`}
              >
                <CardContent className="p-4">
                  {/* Linha Principal (Header do Card) */}
                  <div
                    className="flex cursor-pointer items-start justify-between gap-3"
                    onClick={() => setExpandedId(isExpanded ? null : reqKey)}
                  >
                    <div className="flex flex-col gap-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {req.id || "S/ID"}
                        </span>
                        {getCriticalityBadge(req.criticidade)}
                        {req.tipoControle && (
                          <Badge variant="outline" className="text-[11px] text-gray-600 border-gray-300">
                            {req.tipoControle}
                          </Badge>
                        )}
                        {req.componente && (
                          <span className="text-xs text-gray-500 font-medium">
                            • {req.componente}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-gray-900 leading-snug">
                        {req.controle || "Controle Sem Título"}
                      </h3>

                      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                        {req.detalhamento}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-8 w-8 p-0 text-gray-400 hover:text-gray-700"
                    >
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </Button>
                  </div>

                  {/* Detalhes Expandidos */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-4 text-xs animate-fadeIn">
                      {/* Categoria e Propriedade */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <div>
                          <span className="font-semibold text-gray-500 block">Categoria:</span>
                          <span className="text-gray-800 font-medium">{req.categoria || "N/A"}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-500 block">STRIDE Threat:</span>
                          <span className="text-gray-800 font-medium">{req.strideLM || "N/A"}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-500 block">Mapeamento OWASP:</span>
                          <span className="text-gray-800 font-medium">{req.owasp || "N/A"}</span>
                        </div>
                      </div>

                      {/* Detalhamento Completo */}
                      <div>
                        <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                          <Info className="h-3.5 w-3.5 text-primary" />
                          Detalhamento do Requisito
                        </h4>
                        <p className="text-gray-700 leading-relaxed bg-white p-3 rounded border border-gray-200">
                          {req.detalhamento}
                        </p>
                      </div>

                      {/* Riscos Associados */}
                      {req.riscos && (
                        <div>
                          <h4 className="font-bold text-red-900 mb-1 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                            Riscos de Segurança
                          </h4>
                          <p className="text-red-800 leading-relaxed bg-red-50/60 p-3 rounded border border-red-100">
                            {req.riscos}
                          </p>
                        </div>
                      )}

                      {/* Evidência Exigida */}
                      {req.evidencia && (
                        <div>
                          <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                            <FileCheck className="h-3.5 w-3.5 text-info" />
                            Evidência Exigida em Security QA
                          </h4>
                          <p className="text-gray-700 leading-relaxed bg-blue-50/40 p-3 rounded border border-blue-100">
                            {req.evidencia}
                          </p>
                        </div>
                      )}

                      {/* Como Testar */}
                      {req.comoTestar && (
                        <div>
                          <h4 className="font-bold text-green-900 mb-1 flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            Procedimento de Teste & Validação
                          </h4>
                          <p className="text-gray-700 leading-relaxed bg-green-50/40 p-3 rounded border border-green-100">
                            {req.comoTestar}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-gray-200 bg-white p-8 text-center">
          <CardContent>
            <AlertTriangle className="mx-auto h-8 w-8 text-yellow-500 mb-2" />
            <h3 className="text-base font-bold text-gray-900">Nenhum requisito encontrado</h3>
            <p className="mt-1 text-xs text-gray-500">
              Nenhum item corresponde aos critérios de busca ou filtros selecionados.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 border-gray-300 text-xs"
              onClick={() => {
                setSearchTerm("");
                setSelectedCriticality("TODOS");
                setSelectedComponent("TODOS");
                setSelectedStride("TODOS");
                setCurrentPage(1);
              }}
            >
              Resetar Filtros
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-9 px-3 text-xs"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>

          <span className="text-xs font-semibold text-gray-700 px-3">
            {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-9 px-3 text-xs"
          >
            Próximo
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </section>
  );
}
