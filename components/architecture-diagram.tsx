"use client";

import { useState } from "react";
import { User, Monitor, Server, Database, KeyRound, Shield, Zap, Bot, ChevronRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ArchitectureDiagram() {
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const nodeDetails: Record<string, { title: string; desc: string; tools: string[]; color: string }> = {
    user: {
      title: "Analista SecOps",
      desc: "Usuário do sistema CyberITSM acessando via navegador. Autenticado com MFA.",
      tools: ["Browser", "HTTPS", "MFA/TOTP"],
      color: "border-blue-500 bg-blue-50 text-blue-700"
    },
    frontend: {
      title: "Frontend SPA",
      desc: "Aplicação Next.js renderizada no cliente utilizando o Design System Mistica. Suporta Drag-and-Drop e integra o Agente de IA.",
      tools: ["React 19", "Tailwind CSS v4", "Lucide Icons", "Radix UI"],
      color: "border-vivo bg-vivo/10 text-vivo"
    },
    backend: {
      title: "Next.js Server API",
      desc: "Serverless API e Server Actions rodando na Edge da Vercel. Processa validações de RBAC, sessão, integrações IAM e o endpoint mock do Agente SecOps IA (/api/chat).",
      tools: ["Vercel Edge", "Middleware", "Server Actions", "TypeScript"],
      color: "border-gray-800 bg-gray-100 text-gray-900"
    },
    database: {
      title: "Supabase BaaS & Prisma ORM",
      desc: "Banco de dados PostgreSQL com RLS para isolamento de tenants. Gerencia perfis, autenticação, chamados e logs no Supabase, além dos modelos QaProject e QaResult do Centro de Security QA gerenciados via Prisma ORM v7.",
      tools: ["PostgreSQL", "RLS", "Prisma ORM v7", "Driver Adapters"],
      color: "border-green-600 bg-green-50 text-green-700"
    },
    ai: {
      title: "Agente SecOps IA",
      desc: "Assistente de IA funcional como mock rule-based (app/api/chat/route.ts). Sem LLM externo por padrão; pronto para integrar o Vercel AI SDK com OpenAI/Gemini.",
      tools: ["Next.js Route Handler", "Mock (Regras)", "Vercel AI SDK (futuro)", "OpenAI/Gemini"],
      color: "border-purple-500 bg-purple-50 text-purple-700"
    },
    iam: {
      title: "Integrações IAM / IGA",
      desc: "Simuladores de governança corporativa que sincronizam identidades com Microsoft Entra ID e gerenciam workflows no Sailpoint.",
      tools: ["Entra ID", "Keycloak", "Sailpoint IdentityNow", "Oracle Access Manager"],
      color: "border-orange-500 bg-orange-50 text-orange-700"
    },
    security_qa: {
      title: "Centro de Security QA",
      desc: "Bounded Context isolado para cruzamento inteligente de relatórios brutos (.json/.xml/.txt) com requisitos. Realiza análise Gemini estructurada, compressão GZIP forense, expurgo e geração de PDF.",
      tools: ["@react-pdf/renderer", "Recharts", "zlib/GZIP", "streamObject (Gemini)"],
      color: "border-red-600 bg-red-50 text-red-700"
    }
  };

  return (
    <div className="w-full flex flex-col items-center gap-6 p-4">
      <div className="text-center space-y-2 mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Mapa de Arquitetura Interativo</h3>
        <p className="text-sm text-gray-500">Passe o mouse ou clique nos componentes para ver detalhes técnicos.</p>
      </div>

      <div className="relative w-full max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0 p-8 border border-gray-100 rounded-3xl bg-white shadow-xl">
        
        {/* Background Flow Lines (Desktop) */}
        <div className="absolute hidden md:block top-1/2 left-[10%] right-[10%] h-1 bg-gray-100 -translate-y-1/2 z-0 rounded-full" />
        
        {/* Node: User */}
        <div 
          className="relative z-10 flex flex-col items-center cursor-pointer group"
          onMouseEnter={() => setActiveNode('user')}
          onClick={() => setActiveNode('user')}
        >
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center bg-white border-2 shadow-md transition-all duration-300 ${activeNode === 'user' ? 'border-blue-500 scale-110 shadow-blue-200' : 'border-gray-200 group-hover:border-blue-300'}`}>
            <User className={`w-8 h-8 ${activeNode === 'user' ? 'text-blue-500' : 'text-gray-400'}`} />
          </div>
          <span className="mt-3 font-semibold text-sm text-gray-700">Analista</span>
        </div>

        {/* Arrow */}
        <ChevronRight className="hidden md:block w-6 h-6 text-gray-300 z-10" />

        {/* Node: Frontend */}
        <div 
          className="relative z-10 flex flex-col items-center cursor-pointer group"
          onMouseEnter={() => setActiveNode('frontend')}
          onClick={() => setActiveNode('frontend')}
        >
          <div className={`w-24 h-24 rounded-2xl flex items-center justify-center bg-white border-2 shadow-md transition-all duration-300 ${activeNode === 'frontend' ? 'border-vivo scale-110 shadow-purple-200' : 'border-gray-200 group-hover:border-vivo/50'}`}>
            <Monitor className={`w-10 h-10 ${activeNode === 'frontend' ? 'text-vivo' : 'text-gray-400'}`} />
          </div>
          <span className="mt-3 font-semibold text-sm text-gray-700">Frontend SPA</span>
        </div>

        {/* Arrow */}
        <ChevronRight className="hidden md:block w-6 h-6 text-gray-300 z-10" />

        {/* Node: Backend */}
        <div 
          className="relative z-10 flex flex-col items-center cursor-pointer group"
          onMouseEnter={() => setActiveNode('backend')}
          onClick={() => setActiveNode('backend')}
        >
          <div className={`w-24 h-24 rounded-2xl flex items-center justify-center bg-white border-2 shadow-md transition-all duration-300 ${activeNode === 'backend' ? 'border-gray-800 scale-110 shadow-gray-300' : 'border-gray-200 group-hover:border-gray-500'}`}>
            <Server className={`w-10 h-10 ${activeNode === 'backend' ? 'text-gray-800' : 'text-gray-400'}`} />
          </div>
          <span className="mt-3 font-semibold text-sm text-gray-700">API Next.js</span>
        </div>

        {/* Fork Arrows */}
        <div className="hidden md:flex flex-col gap-10 z-10">
           <ChevronRight className="w-6 h-6 text-gray-300 -mt-8" />
           <ChevronRight className="w-6 h-6 text-gray-300" />
           <ChevronRight className="w-6 h-6 text-gray-300" />
        </div>

        <div className="flex flex-col gap-6 z-10">
          {/* Node: Database */}
          <div 
            className="flex flex-col items-center cursor-pointer group"
            onMouseEnter={() => setActiveNode('database')}
            onClick={() => setActiveNode('database')}
          >
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center bg-white border-2 shadow-md transition-all duration-300 ${activeNode === 'database' ? 'border-green-500 scale-110 shadow-green-200' : 'border-gray-200 group-hover:border-green-300'}`}>
              <Database className={`w-8 h-8 ${activeNode === 'database' ? 'text-green-500' : 'text-gray-400'}`} />
            </div>
            <span className="mt-3 font-semibold text-sm text-gray-700">Supabase</span>
          </div>

          {/* Node: AI Agent */}
          <div 
            className="flex flex-col items-center cursor-pointer group"
            onMouseEnter={() => setActiveNode('ai')}
            onClick={() => setActiveNode('ai')}
          >
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center bg-white border-2 shadow-md transition-all duration-300 ${activeNode === 'ai' ? 'border-purple-500 scale-110 shadow-purple-200' : 'border-gray-200 group-hover:border-purple-300'}`}>
              <Bot className={`w-8 h-8 ${activeNode === 'ai' ? 'text-purple-500' : 'text-gray-400'}`} />
            </div>
            <span className="mt-3 font-semibold text-sm text-gray-700">Agente IA</span>
          </div>

          {/* Node: IAM */}
          <div 
            className="flex flex-col items-center cursor-pointer group"
            onMouseEnter={() => setActiveNode('iam')}
            onClick={() => setActiveNode('iam')}
          >
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center bg-white border-2 shadow-md transition-all duration-300 ${activeNode === 'iam' ? 'border-orange-500 scale-110 shadow-orange-200' : 'border-gray-200 group-hover:border-orange-300'}`}>
              <KeyRound className={`w-8 h-8 ${activeNode === 'iam' ? 'text-orange-500' : 'text-gray-400'}`} />
            </div>
            <span className="mt-3 font-semibold text-sm text-gray-700">Rede IAM</span>
          </div>

          {/* Node: Security QA */}
          <div 
            className="flex flex-col items-center cursor-pointer group"
            onMouseEnter={() => setActiveNode('security_qa')}
            onClick={() => setActiveNode('security_qa')}
          >
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center bg-white border-2 shadow-md transition-all duration-300 ${activeNode === 'security_qa' ? 'border-red-600 scale-110 shadow-red-200' : 'border-gray-200 group-hover:border-red-300'}`}>
              <Shield className={`w-8 h-8 ${activeNode === 'security_qa' ? 'text-red-600' : 'text-gray-400'}`} />
            </div>
            <span className="mt-3 font-semibold text-sm text-gray-700">Security QA</span>
          </div>
        </div>

      </div>

      {/* Details Panel */}
      <div className="w-full max-w-4xl h-48 mt-4">
        {activeNode ? (
          <Card className={`border-2 animate-fadeIn shadow-sm ${nodeDetails[activeNode].color.split(' ')[0]}`}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <h4 className="text-xl font-bold mb-2 text-gray-900 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    {nodeDetails[activeNode].title}
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {nodeDetails[activeNode].desc}
                  </p>
                </div>
                <div className="md:w-1/3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Stack Tecnológica</h5>
                  <div className="flex flex-wrap gap-2">
                    {nodeDetails[activeNode].tools.map((tool, i) => (
                      <span key={i} className={`text-xs px-2.5 py-1 rounded-md font-semibold border ${nodeDetails[activeNode].color}`}>
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="w-full h-full border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 text-sm bg-gray-50/50">
            Selecione um componente da arquitetura acima para visualizar detalhes técnicos e fluxos de segurança.
          </div>
        )}
      </div>
    </div>
  );
}
