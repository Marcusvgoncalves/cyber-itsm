"use client";

import { useState } from "react";
import {
  User,
  Monitor,
  Server,
  Database,
  Shield,
  Zap,
  Bot,
  ChevronRight,
  Sparkles,
  BookOpen,
  Layers,
  Lock,
  ArrowRight,
  X,
  CheckCircle2,
  BarChart3,
  FileArchive,
  KeyRound,
  Settings,
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
      desc: "Interface cliente acessada via navegador corporativo. A sessão é protegida por MFA TOTP (RFC 6238), expirando em 1 hora de uso contínuo e em 15 minutos por inatividade (idle timeout). O histórico de chat do Copiloto é totalmente mantido localmente em localStorage.",
      details: [
        "Sessão Ativa: Limite máximo de 1 hora de uso contínuo sem perda de histórico",
        "Sessão Inativa: Expiração automática após 15 minutos de inatividade",
        "Persistência local do histórico de conversas no browser (localStorage por usuário)",
        "Proteção contra Brute-Force com limitação por IP e conta",
      ],
      tools: ["Browser Client", "HTTPS (TLS 1.3)", "MFA/TOTP (RFC 6238)", "localStorage", "Session Lifetime Manager"],
      color: "border-blue-500 bg-blue-50/80 text-blue-700",
      iconBg: "bg-blue-600 text-white",
    },
    frontend: {
      title: "Frontend SPA (Next.js 16 App Router)",
      subtitle: "Interface Reativa & Dashboards Interativos",
      desc: "Aplicação Next.js 16 em React 19 renderizada no cliente. Inclui Kanban Board Hierárquico (Épico/Atividade/Tarefa), Checklist Interativo, Dashboard Volumétrico com calculadora de criticidade, Dashboard de Security QA com Recharts, catálogo da Base de Conhecimento e Painel de Configurações & Cadastros com Matriz SoD.",
      details: [
        "Kanban Hierárquico Jira/Trello (Épico, Atividade, Tarefa) e Checklist com barra de %",
        "Validação de Drag-and-Drop em tempo real contra a matriz de transições de status",
        "Kanban & Security QA Dashboards com gráficos Recharts e calculadoras de criticidade",
        "Gestão de Sprints, Due Dates e Epic QA (Kanban ↔ Security QA Engine)",
        "Painel de Configurações & Cadastros com proteção SoD (Admin-Only)",
      ],
      tools: ["React 19", "Next.js 16", "Tailwind CSS v4", "Recharts", "Lucide Icons", "Radix UI"],
      color: "border-purple-600 bg-purple-50/80 text-purple-800",
      iconBg: "bg-purple-600 text-white",
    },
    backend: {
      title: "Edge Proxy, Validações & Server Actions",
      subtitle: "Roteamento Edge, Máquina de Estados, SoD & Conectores",
      desc: "Serverless API na Vercel com Middleware Proxy (`proxy.ts`) e Server Actions (`tickets.ts`, `cadastros.ts`). Garante a máquina de estados estrita de chamados, imutabilidade do tipo, guardrails de fechamento de Épicos, CRUD de cadastros com Matriz SoD e executa conectores B2B (Jira, ServiceNow, M365) via MTLS.",
      details: [
        "Validação centralizada de Máquina de Estados (ABERTO, EM_ANDAMENTO, BLOQUEADO, FECHADO, CANCELADO)",
        "Guardrail de fechamento de Épicos e Imutabilidade do Tipo de chamado pós-criação",
        "Server Actions de Cadastros protegidas por Matriz SoD (ADMIN-only via rbac.ts)",
        "Integrações nativas B2B seguras com Jira, ServiceNow e Microsoft 365 via MTLS",
        "Endpoints SCIM v2.0 (/api/scim/v2/Users) e SAML 2.0 SSO",
      ],
      tools: ["Vercel Edge Network", "MTLS / Certificados PEM", "B2B Connectors", "RBAC/SoD Matrix", "TypeScript"],
      color: "border-gray-800 bg-gray-100 text-gray-900",
      iconBg: "bg-gray-800 text-white",
    },
    ai: {
      title: "Copiloto IA Multiagente & Contingência (Zero Downtime)",
      subtitle: "Esteira de Resiliência Multiagente com RAG & Contexto Global",
      desc: "Motor de inteligência artificial generativa com roteamento automatizado em cascata: 1) SambaNova (Meta-Llama 3.3 70B, gratuito) -> 2) SambaNova (Meta-Llama 3.1 8B, gratuito) -> 3) OpenRouter (DeepSeek V3, pago) -> 4) OpenRouter (Claude 3.5 Haiku, pago) -> Motor Determinístico de Fallback contextualizado com SystemContext do banco. Integra RAG sobre os 314 requisitos normativos (Top-K ≤ 3, cosseno > 0.78).",
      details: [
        "Higiene rigorosa e autônoma de contexto a cada login (Clean Memory)",
        "Roteamento multiagente em camadas (SambaNova → OpenRouter) com economia de tokens e fallback pago apenas em emergência",
        "OpenRouter (DeepSeek V3 / Claude 3.5 Haiku) como contingência paga de produção",
        "Motor determinístico enriquecido com estatísticas históricas de tickets, projetos e compliance",
        "RAG inteligente consultando o dataset dos 314 requisitos SD v4.1",
        "Automação ativa via MCP Local (in-process): abrir/mover chamados no Kanban, buscar requisitos e gerar parecer STRIDE (.md) — 5 ferramentas",
      ],
      tools: ["SambaNova (Llama 3.3 70B)", "SambaNova (Llama 3.1 8B)", "OpenRouter (DeepSeek V3)", "OpenRouter (Claude 3.5 Haiku)", "MCP Local (5 tools)", "Deterministic Engine", "Zod", "RAG Engine"],
      color: "border-indigo-600 bg-indigo-50/80 text-indigo-800",
      iconBg: "bg-indigo-600 text-white",
    },
    security_qa: {
      title: "Centro de Security QA & Dashboard Analytics",
      subtitle: "Motor Autônomo Analítico, GZIP Forensics e Guia PDF",
      desc: "Bounded Context isolado para auditoria autônoma de evidências de segurança e anexos (JSON, XML, TXT, DOCX, PDF, Imagens). Possui OCR e parsing avançado, compressão GZIP forense de artefatos brutos (< 10MB), expurgo (Zero Data Leak) e exportação robusta de PDF via @react-pdf/renderer.",
      details: [
        "Parsing e OCR de evidências documentais anexadas (limite de 10MB por arquivo)",
        "Cruzamento autônomo de relatórios brutos contra requisitos de arquitetura",
        "Execução em segundo plano via Next.js after() e workers assíncronos Inngest",
        "Arquivamento forense comprimido via GZIP com tempo de vida limitado",
        "Geração de relatórios executivos, laudos e manuais em PDF via @react-pdf/renderer",
      ],
      tools: ["OCR / Document Parser", "PDF Native Export", "zlib/GZIP Forensics", "QA Engine API", "Next.js after()", "Recharts"],
      color: "border-red-600 bg-red-50/80 text-red-800",
      iconBg: "bg-red-600 text-white",
    },
    database: {
      title: "Supabase BaaS & Prisma ORM v7",
      subtitle: "Persistência Relacional & RLS Multi-tenant",
      desc: "Banco de dados PostgreSQL 16 hospedado no Supabase. Utiliza Row Level Security (RLS) para isolamento rigoroso entre tenants. Gerencia perfis, chamados, sprints, notificações, requisitos dinâmicos, logs de auditoria, tabela llm_call_logs e os modelos de Security QA via Prisma ORM v7.",
      details: [
        "PostgreSQL 16 com políticas RLS por empresa/tenant",
        "Prisma ORM v7 com SqlDriverAdapter para máxima performance SQL",
        "Tabela llm_call_logs com telemetria e custos acumulados por provedor",
        "Models: Sprint, NotificationSetting, Ticket (sprint_id, due_date), LlmCallLog e QaResult",
        "Trilha de auditoria imutável com timestamp forense",
        "Armazenamento de evidências brutas e arquivadas no Supabase Storage",
      ],
      tools: ["PostgreSQL 16", "Row Level Security (RLS)", "Prisma ORM v7", "SqlDriverAdapter", "Supabase BaaS"],
      color: "border-green-600 bg-green-50/80 text-green-800",
      iconBg: "bg-green-600 text-white",
    },
    iam: {
      title: "Portal IAM/IGA e Configurações",
      subtitle: "Governança de Identidade, SSO & Preferências Locais",
      desc: "Portal integrado de governança de acesso corporativo reorganizado em 4 sub-abas internas (Provedores & Integrações, Identidades Sincronizadas, Workflows JIT & Aprovações, Usuários do Sistema & MFA RBAC). Inclui telemetria com cálculo inteligente de renovação de cotas de LLM (diário às 00:00 UTC vs mensal no dia 1).",
      details: [
        "Painel de Logs de Auditoria transacionais (HTTP, IP) com exportação imediata em CSV",
        "Sub-navegação em 4 abas dinâmicas reduzindo lacunas e otimizando a experiência UI/UX",
        "Inteligência de renovação de cotas de LLM com contagem regressiva de tempo restante",
        "API SCIM v2.0 (/api/scim/v2/Users) para ciclo de vida de identidades",
        "Endpoints SAML 2.0 SSO (/api/saml/sso e metadata XML)",
        "Fluxos de aprovação Just-In-Time com segregação de funções (SoD)",
      ],
      tools: ["CSV Logs Exporter", "SCIM v2.0 API", "SAML 2.0 SSO", "Microsoft Entra ID", "Keycloak", "Sailpoint Simulator"],
      color: "border-amber-600 bg-amber-50/80 text-amber-800",
      iconBg: "bg-amber-600 text-white",
    },
    req_catalog: {
      title: "Base de Conhecimento SD v4.1",
      subtitle: "314 Requisitos Normativos Estruturados",
      desc: "Dataset completo de 314 requisitos de segurança de desenvolvimento e arquitetura. Mapeados com OWASP Top 10, NIST CSF, CIS Controls, ISO 27001, ameaças STRIDE LM e scripts de validação de auditoria.",
      details: [
        "314 requisitos categorizados com filtros por criticidade e busca rápida",
        "Mapeamento explícito de STRIDE, OWASP, NIST e Controles CIS",
        "Fichas de validação com evidências exigidas e procedimentos de teste",
        "Utilizado como base de conhecimento primária pelo RAG do Copiloto IA",
      ],
      tools: ["JSON Dataset (314 items)", "Busca por Expressões", "Catálogo Interativo UI", "Framework SD v4.1"],
      color: "border-teal-600 bg-teal-50/80 text-teal-800",
      iconBg: "bg-teal-600 text-white",
    },
    cadastros_sod: {
      title: "Cadastros (SoD Admin Panel)",
      subtitle: "Governança de Sprints, Notificações & Requisitos Dinâmicos",
      desc: "Módulo de governança restrito ao perfil ADMIN com Matriz SoD (Separation of Duties). Permite o cadastro e gestão de Sprints de entrega, Preferências de Notificação por evento e canal, e uma Matriz Dinâmica de Requisitos de Segurança customizados que complementam a base estática dos 314 controles SD v4.1.",
      details: [
        "Matriz SoD: 3 perfis (ADMIN, USUARIO, SOLICITANTE) e 8 permissões granulares",
        "CRUD de Sprints com auditoria (nome, objetivo, datas, status)",
        "Configuração de Notificações por evento × canal com toggles de ativação",
        "CRUD de Requisitos Dinâmicos (custom=true) com ID, controle, STRIDE, OWASP",
        "Toda operação gera registro na trilha de auditoria (audit_logs)",
      ],
      tools: ["Server Actions (cadastros.ts)", "RBAC Matrix (rbac.ts)", "Prisma ORM v7", "Audit Trail", "SoD Enforcement"],
      color: "border-cyan-600 bg-cyan-50/80 text-cyan-800",
      iconBg: "bg-cyan-600 text-white",
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
                  <p className="text-xs text-gray-500">Next.js 16 + Dashboards</p>
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
                  <h4 className="font-bold text-sm text-gray-900">Edge Proxy &amp; API</h4>
                  <p className="text-xs text-gray-500">Rate Limit + SCIM/SAML</p>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 3: Inteligência & Security QA */}
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
                  <p className="text-xs text-gray-500">SambaNova/OpenRouter</p>
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
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Centro Security QA</h4>
                  <p className="text-xs text-gray-500">Engine + GZIP + Dashboard</p>
                </div>
              </div>
            </div>
          </div>

          {/* Coluna 4: Governança & Persistência */}
          <div className="flex flex-col gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 text-center">Dados &amp; Identidade</span>
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
                  <h4 className="font-bold text-sm text-gray-900">Portal IAM/IGA e Configurações</h4>
                  <p className="text-xs text-gray-500">SCIM v2.0 + SAML 2.0</p>
                </div>
              </div>
            </div>

            <div
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                activeNode === "cadastros_sod" ? "border-cyan-600 shadow-lg shadow-cyan-100 scale-105" : "border-gray-200 hover:border-cyan-300 bg-gray-50/50"
              }`}
              onClick={() => {
                setActiveNode("cadastros_sod");
                setSelectedNodeModal("cadastros_sod");
              }}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-600 text-white">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Cadastros</h4>
                  <p className="text-xs text-gray-500">Sprints, Notif. &amp; Requisitos</p>
                </div>
              </div>
            </div>

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
                  <h4 className="font-bold text-sm text-gray-900">Supabase &amp; Prisma</h4>
                  <p className="text-xs text-gray-500">PostgreSQL 16 + RLS</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Detalhes do Nó Selecionado */}
      {activeNode && nodeDetails[activeNode] && (
        <Card className={`w-full max-w-5xl border-2 ${nodeDetails[activeNode].color} shadow-lg transition-all duration-300`}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${nodeDetails[activeNode].iconBg}`}>
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900">{nodeDetails[activeNode].title}</h4>
                  <p className="text-xs font-semibold text-gray-500">{nodeDetails[activeNode].subtitle}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs bg-white border-current">
                Componente C4 Nível 2
              </Badge>
            </div>

            <p className="text-sm text-gray-700 leading-relaxed">{nodeDetails[activeNode].desc}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Destaques de Arquitetura</span>
                <ul className="space-y-1">
                  {nodeDetails[activeNode].details.map((detail, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-gray-700">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Tecnologias &amp; Padrões</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {nodeDetails[activeNode].tools.map((tool, idx) => (
                    <Badge key={idx} className="bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 text-[11px]">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal Detalhado */}
      {selectedNodeModal && nodeDetails[selectedNodeModal] && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${nodeDetails[selectedNodeModal].iconBg}`}>
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{nodeDetails[selectedNodeModal].title}</h3>
                  <p className="text-xs text-gray-500">{nodeDetails[selectedNodeModal].subtitle}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedNodeModal(null)} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-700 leading-relaxed">{nodeDetails[selectedNodeModal].desc}</p>
              
              <div className="bg-gray-50 p-4 rounded-2xl space-y-2 border">
                <h5 className="text-xs font-bold uppercase text-gray-600">Requisitos Técnicos e Capacidades</h5>
                <ul className="space-y-1.5">
                  {nodeDetails[selectedNodeModal].details.map((d, i) => (
                    <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h5 className="text-xs font-bold uppercase text-gray-600 mb-2">Stack Integrada</h5>
                <div className="flex flex-wrap gap-2">
                  {nodeDetails[selectedNodeModal].tools.map((t, i) => (
                    <Badge key={i} className="bg-primary/10 text-primary border-primary/20">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setSelectedNodeModal(null)}>Fechar Visão Detalhada</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
