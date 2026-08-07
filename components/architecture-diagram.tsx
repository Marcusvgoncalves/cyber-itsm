"use client";

import { useState } from "react";
import {
  User,
  Monitor,
  Server,
  Database,
  KeyRound,
  Shield,
  Zap,
  Bot,
  ChevronRight,
  Sparkles,
  BookOpen,
  Cpu,
  Layers,
  Lock,
  ArrowRight,
  X,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ArchitectureDiagram() {
  const [activeNode, setActiveNode] = useState<string>("ai");
  const [selectedNodeModal, setSelectedNodeModal] = useState<string | null>(null);

  const nodeDetails: Record<
    string,
    {
      title: string;
      subtitle: string;
      desc: string;
      details: string[];
      tools: string[];
      color: string;
      iconBg: string;
    }
  > = {
    user: {
      title: "Analista SecOps & Sessão Reativa",
      subtitle: "Autenticação, MFA e Timeout de Sessão",
      desc: "Interface cliente acessada via navegador corporativo. A sessão é protegida por MFA TOTP, expirando em 1 hora de uso contínuo e em 15 minutos por inatividade. Todo o histórico de chat do Copiloto é persistido em localStorage por usuário.",
      details: [
        "Sessão Ativa: Limite máximo de 1 hora de uso",
        "Sessão Inativa: Expiração automática em 15 minutos",
        "Persistência local do histórico de conversas no browser",
        "Proteção contra Brute-Force com limitação por IP e conta",
      ],
      tools: ["Browser Client", "HTTPS (TLS 1.3)", "MFA/TOTP", "localStorage", "Session Lifetime"],
      color: "border-blue-500 bg-blue-50/80 text-blue-700",
      iconBg: "bg-blue-600 text-white",
    },
    frontend: {
      title: "Frontend SPA (Next.js 16 App Router)",
      subtitle: "Interface Reativa & Kanban Dashboard",
      desc: "Aplicação Next.js 16 em React 19 renderizada no cliente. Suporta drag-and-drop no Kanban, visualização gráfica de volumetria no Dashboard (Recharts), calculadora de criticidade e catálogo interativo da Base de Conhecimento.",
      details: [
        "Kanban Board com atualização em tempo real",
        "Dashboard de volumetria com previsão de criticidade e SLAs",
        "Catálogo interativo com pesquisa dos 314 Requisitos SD v4.1",
        "Componentes visuais no padrão Mistica / Tailwind CSS",
      ],
      tools: ["React 19", "Next.js 16", "Tailwind CSS", "Recharts", "Lucide Icons", "Radix UI"],
      color: "border-purple-600 bg-purple-50/80 text-purple-800",
      iconBg: "bg-purple-600 text-white",
    },
    backend: {
      title: "Edge Proxy & Next.js Server API",
      subtitle: "Roteamento Edge, Rate Limit & Autenticação",
      desc: "Serverless Edge API na Vercel com Middleware Proxy. Executa verificações de autorização RBAC, previne estouro de quota capturando erros HTTP 429 e gerencia tokens OAuth 2.0 / SAML 2.0 / SCIM v2.0.",
      details: [
        "Interceptação de Rate Limit (HTTP 429 / RESOURCE_EXHAUSTED)",
        "Validação síncrona de sessão em proxy.ts",
        "Handlers de chamados, auditoria e sincronização IAM",
        "Roteamento de alta velocidade em arquitetura Serverless",
      ],
      tools: ["Vercel Edge Network", "Middleware Proxy", "Server Actions", "TypeScript", "HTTP 429 Interceptor"],
      color: "border-gray-800 bg-gray-100 text-gray-900",
      iconBg: "bg-gray-800 text-white",
    },
    ai: {
      title: "Copiloto IA Multiagente (Zero Downtime)",
      subtitle: "Esteira de Resiliência de 3 Camadas com RAG",
      desc: "Motor de inteligência artificial com fallback encadeado sem falhas. Tenta sequencialmente: 1) Groq (Llama 3.1 8B) -> 2) OpenRouter (DeepSeek R1/Chat) -> 3) Google Gemini (1.5 Flash). Integra RAG consultando os 314 requisitos de segurança em tempo real.",
      details: [
        "Fallback transparente entre 3 provedores de IA gratuitos",
        "RAG inteligente nos 314 requisitos do catálogo SD v4.1",
        "Tratamento automático de Rate Limit (429) com mensagens amigáveis",
        "Suporte a suporte técnico no Kanban e modelagem de ameaças STRIDE",
      ],
      tools: ["Groq (Llama 3.1)", "OpenRouter (DeepSeek)", "Google Gemini 1.5 Flash", "Vercel AI SDK", "RAG Engine"],
      color: "border-indigo-600 bg-indigo-50/80 text-indigo-800",
      iconBg: "bg-indigo-600 text-white",
    },
    database: {
      title: "Supabase BaaS & Prisma ORM v7",
      subtitle: "Persistência Relacional & RLS Multi-tenant",
      desc: "Banco de dados PostgreSQL hospedado no Supabase. Utiliza Row Level Security (RLS) para isolamento rigoroso entre tenants. Gerencia perfis, chamados, logs de auditoria e os modelos de Security QA via Prisma ORM v7 com Driver Adapters.",
      details: [
        "PostgreSQL 16 com políticas RLS por empresa/tenant",
        "Prisma ORM v7 com driver adapter para performance SQL",
        "Logs de auditoria imutáveis com timestamp forense",
        "Armazenamento de evidências temporárias no Supabase Storage",
      ],
      tools: ["PostgreSQL 16", "Row Level Security (RLS)", "Prisma ORM v7", "SqlDriverAdapter", "Supabase BaaS"],
      color: "border-green-600 bg-green-50/80 text-green-800",
      iconBg: "bg-green-600 text-white",
    },
    security_qa: {
      title: "Centro de Security QA (Engine Autônoma)",
      subtitle: "Validação Forense de Evidências com Gemini",
      desc: "Bounded Context isolado para cruzamento automático de relatórios de segurança com requisitos. Executa streamObject com Gemini, compressão GZIP forense de artefatos brutos, expurgo automático e exportação de PDF.",
      details: [
        "Cruzamento automático de evidências com a matriz SD v4.1",
        "Cálculo de índice de conformidade % e rating de risco",
        "Arquivamento forense comprimido via GZIP",
        "Geração de relatórios executivos em PDF via @react-pdf",
      ],
      tools: ["@react-pdf/renderer", "zlib/GZIP Forensics", "Gemini streamObject", "Recharts", "Prisma QA Schema"],
      color: "border-red-600 bg-red-50/80 text-red-800",
      iconBg: "bg-red-600 text-white",
    },
    iam: {
      title: "Portal IAM / IGA & SCIM v2.0",
      subtitle: "Governança de Identidade e SSO Corporativo",
      desc: "Portal integrado de governança de acesso. Suporta provisionamento automatizado via SCIM v2.0, autenticação federada SAML 2.0 / OAuth 2.0, aprovações JIT (Just-In-Time) e simulação de conectores Microsoft Entra ID e Keycloak.",
      details: [
        "API SCIM v2.0 (/api/scim/v2/Users) para ciclo de vida de identidades",
        "Endpoints SAML 2.0 (SSO e Metadata XML)",
        "Fluxos de solicitação e aprovação com segregação de funções (SoD)",
        "Sincronização bidirecional de papéis e revogação de acessos",
      ],
      tools: ["SCIM v2.0 API", "SAML 2.0 SSO", "OAuth 2.0", "Microsoft Entra ID", "Keycloak", "Sailpoint Simulator"],
      color: "border-amber-600 bg-amber-50/80 text-amber-800",
      iconBg: "bg-amber-600 text-white",
    },
    req_catalog: {
      title: "Base de Conhecimento SD v4.1",
      subtitle: "314 Requisitos Normativos Estruturados",
      desc: "Dataset completo de 314 requisitos de segurança de desenvolvimento e arquitetura. Mapeados com OWASP Top 10, NIST CSF, CIS Controls, ISO 27001, ameaças STRIDE LM e orientações de validação.",
      details: [
        "314 requisitos categorizados por componente e criticidade",
        "Mapeamento explícito de STRIDE, OWASP e Controles CIS",
        "Evidências exigidas e scripts de teste de validação",
        "Utilizado como base de conhecimento pelo RAG do Copiloto IA",
      ],
      tools: ["JSON Dataset (314 items)", "Tokenizer TF-IDF", "Catálogo Interativo UI", "Framework SD v4.1"],
      color: "border-teal-600 bg-teal-50/80 text-teal-800",
      iconBg: "bg-teal-600 text-white",
    },
  };

  return (
    <div className="w-full flex flex-col items-center gap-6 p-4">
      {/* Título do Mapa */}
      <div className="text-center space-y-2 mb-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-4 w-4" />
          Arquitetura Enterprise C4 - Nível 2
        </div>
        <h3 className="text-2xl font-bold text-gray-900 sm:text-3xl">Desenho de Arquitetura Interativo</h3>
        <p className="text-sm text-gray-500 max-w-xl mx-auto">
          Clique ou passe o cursor sobre os módulos abaixo para examinar os detalhes de segurança, pilha tecnológica e fluxos de dados.
        </p>
      </div>

      {/* Container Principal do Mapa Visual */}
      <div className="relative w-full max-w-5xl mx-auto p-6 md:p-8 border border-gray-200 rounded-3xl bg-white shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
          
          {/* Coluna 1: Cliente / Browser */}
          <div className="flex flex-col gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 text-center">Perímetro Cliente</span>
            <div
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                activeNode === "user" ? "border-blue-500 shadow-lg shadow-blue-100 scale-105" : "border-gray-200 hover:border-blue-300 bg-gray-50/50"
              }`}
              onClick={() => {
                setActiveNode("user");
                setSelectedNodeModal("user");
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600 text-white">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Analista SecOps</h4>
                  <p className="text-xs text-gray-500">Sessão 1h / 15m Idle</p>
                </div>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                activeNode === "req_catalog" ? "border-teal-500 shadow-lg shadow-teal-100 scale-105" : "border-gray-200 hover:border-teal-300 bg-gray-50/50"
              }`}
              onClick={() => {
                setActiveNode("req_catalog");
                setSelectedNodeModal("req_catalog");
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-teal-600 text-white">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Base de Requisitos</h4>
                  <p className="text-xs text-gray-500">314 Controles SD v4.1</p>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 2: Frontend & Edge */}
          <div className="flex flex-col gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 text-center">Camada de Aplicação</span>
            <div
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                activeNode === "frontend" ? "border-purple-600 shadow-lg shadow-purple-100 scale-105" : "border-gray-200 hover:border-purple-300 bg-gray-50/50"
              }`}
              onClick={() => {
                setActiveNode("frontend");
                setSelectedNodeModal("frontend");
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-600 text-white">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Frontend SPA</h4>
                  <p className="text-xs text-gray-500">Next.js 16 + Kanban</p>
                </div>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                activeNode === "backend" ? "border-gray-800 shadow-lg shadow-gray-200 scale-105" : "border-gray-200 hover:border-gray-400 bg-gray-50/50"
              }`}
              onClick={() => {
                setActiveNode("backend");
                setSelectedNodeModal("backend");
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gray-800 text-white">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Edge Proxy & API</h4>
                  <p className="text-xs text-gray-500">Rate Limit 429 Interceptor</p>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 3: Inteligência & Governança */}
          <div className="flex flex-col gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 text-center">Motores Especializados</span>
            <div
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                activeNode === "ai" ? "border-indigo-600 shadow-lg shadow-indigo-100 scale-105" : "border-gray-200 hover:border-indigo-300 bg-gray-50/50"
              }`}
              onClick={() => {
                setActiveNode("ai");
                setSelectedNodeModal("ai");
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Copiloto IA Multiagente</h4>
                  <p className="text-xs text-gray-500">Groq / OpenRouter / Gemini</p>
                </div>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                activeNode === "iam" ? "border-amber-600 shadow-lg shadow-amber-100 scale-105" : "border-gray-200 hover:border-amber-300 bg-gray-50/50"
              }`}
              onClick={() => {
                setActiveNode("iam");
                setSelectedNodeModal("iam");
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-600 text-white">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Portal IAM & SCIM</h4>
                  <p className="text-xs text-gray-500">SAML 2.0 / SCIM v2.0 SSO</p>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 4: Dados & QA Engine */}
          <div className="flex flex-col gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 text-center">Persistência & QA</span>
            <div
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                activeNode === "database" ? "border-green-600 shadow-lg shadow-green-100 scale-105" : "border-gray-200 hover:border-green-300 bg-gray-50/50"
              }`}
              onClick={() => {
                setActiveNode("database");
                setSelectedNodeModal("database");
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-green-600 text-white">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Supabase & Prisma v7</h4>
                  <p className="text-xs text-gray-500">Postgres + RLS Isolation</p>
                </div>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                activeNode === "security_qa" ? "border-red-600 shadow-lg shadow-red-100 scale-105" : "border-gray-200 hover:border-red-300 bg-gray-50/50"
              }`}
              onClick={() => {
                setActiveNode("security_qa");
                setSelectedNodeModal("security_qa");
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-600 text-white">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Security QA Engine</h4>
                  <p className="text-xs text-gray-500">Relatórios & GZIP Forensics</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Painel de Detalhes Ativo abaixo do diagrama */}
      <div className="w-full max-w-5xl mt-2">
        {activeNode && nodeDetails[activeNode] && (
          <Card className={`border-2 transition-all duration-300 shadow-md ${nodeDetails[activeNode].color.split(" ")[0]} bg-white`}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`p-2 rounded-lg text-xs font-bold ${nodeDetails[activeNode].iconBg}`}>
                      {nodeDetails[activeNode].title.split(" ")[0]}
                    </span>
                    <div>
                      <h4 className="text-lg font-bold text-gray-900">{nodeDetails[activeNode].title}</h4>
                      <p className="text-xs font-semibold text-gray-500">{nodeDetails[activeNode].subtitle}</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 leading-relaxed">
                    {nodeDetails[activeNode].desc}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    {nodeDetails[activeNode].details.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-gray-800 bg-gray-50 p-2 rounded border border-gray-100">
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="md:w-72 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Stack Tecnológica</h5>
                  <div className="flex flex-wrap gap-1.5">
                    {nodeDetails[activeNode].tools.map((tool, i) => (
                      <Badge key={i} variant="outline" className="text-[11px] font-semibold bg-white border-gray-300 text-gray-800">
                        {tool}
                      </Badge>
                    ))}
                  </div>

                  <Button
                    variant="default"
                    size="sm"
                    className="w-full mt-4 text-xs gap-1.5 font-semibold"
                    onClick={() => setSelectedNodeModal(activeNode)}
                  >
                    Ver Ficha Completa
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Detalhes Expandidos ao Clicar em qualquer Componente */}
      {selectedNodeModal && nodeDetails[selectedNodeModal] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setSelectedNodeModal(null)}
              className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-xl ${nodeDetails[selectedNodeModal].iconBg}`}>
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">{nodeDetails[selectedNodeModal].title}</h3>
                <p className="text-xs font-semibold text-gray-500">{nodeDetails[selectedNodeModal].subtitle}</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-gray-700">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-1">Descrição Funcional</h4>
                <p className="leading-relaxed">{nodeDetails[selectedNodeModal].desc}</p>
              </div>

              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-2">Controles e Atributos Técnicos</h4>
                <div className="space-y-2">
                  {nodeDetails[selectedNodeModal].details.map((detail, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-blue-50/40 border border-blue-100 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="font-medium text-gray-800">{detail}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-2">Ferramentas & Protocolos Integrais</h4>
                <div className="flex flex-wrap gap-2">
                  {nodeDetails[selectedNodeModal].tools.map((tool, idx) => (
                    <Badge key={idx} className="bg-primary/10 text-primary border-primary/20 text-xs py-1 px-3">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setSelectedNodeModal(null)} className="px-6">
                Fechar Ficha
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
