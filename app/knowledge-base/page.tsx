"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  BookOpen,
  Layers,
  Play,
  Rocket,
  Search,
  ShieldAlert,
  Sparkles,
  Workflow,
} from "lucide-react";

interface FaqEntry {
  question: string;
  answer: string[];
}

interface FaqCategory {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  items: FaqEntry[];
}

const FAQ: FaqCategory[] = [
  {
    id: "primeiros-passos",
    title: "Primeiros Passos",
    description: "Comece a usar a plataforma em minutos.",
    icon: <Rocket className="h-5 w-5 text-primary" />,
    items: [
      {
        question: "Como abro um novo chamado de segurança?",
        answer: [
          "No painel, acesse a aba 'Quadro Kanban' e clique no botão 'Novo Chamado'.",
          "Preencha o título e a descrição detalhada do chamado.",
          "Selecione a prioridade (Baixa, Média, Alta ou Crítica).",
          "Informe o Framework de origem (ex.: NIST, CIS, ISO 27001) e o domínio aplicável.",
          "Clique em 'Criar' — o chamado aparece na coluna inicial do Kanban.",
        ],
      },
      {
        question: "Como navego entre as principais áreas do painel?",
        answer: [
          "Use o menu superior do Painel para alternar entre as áreas.",
          "'Quadro Kanban': gerencie os chamados em etapas.",
          "Portal IAM/IGA: aprovações, provisionamento e gestão de identidade.",
          "Audit Logs: rastreabilidade das ações (somente administradores).",
        ],
      },
    ],
  },
  {
    id: "gestao-chamados",
    title: "Gestão de Chamados",
    description: "Acompanhe e evolua seus chamados no ciclo de vida.",
    icon: <Workflow className="h-5 w-5 text-vivo" />,
    items: [
      {
        question: "Como funciona a esteira de DevSecOps integrada?",
        answer: [
          "Todo código novo passa pelo agente antes de chegar à produção.",
          "Na entrega, o repositório é analisado automaticamente contra a base de requisitos (SD v4.1).",
          "Falhas críticas são reportadas e bloqueiam o deploy na Vercel.",
          "Somente após passar nas validações o código é publicado em produção.",
        ],
      },
      {
        question: "Como acompanho o status dos meus chamados?",
        answer: [
          "No Quadro Kanban, cada coluna representa um estado: Aberto, Em Andamento, Em Revisão, Fechado e Cancelado.",
          "Arraste o card do chamado entre as colunas para atualizar o status.",
          "Abert por equipe, os usuários veem apenas seus chamados; administradores/analistas veem todos.",
        ],
      },
    ],
  },
  {
    id: "assistente-ia",
    title: "Assistente IA",
    description: "O Copiloto de Cibersegurança da plataforma.",
    icon: <Sparkles className="h-5 w-5 text-info" />,
    items: [
      {
        question: "Como utilizo o Copiloto de IA?",
        answer: [
          "O Copiloto fica na lateral do chamado (ícone do bot na interface do painel).",
          "Ele lê automaticamente o contexto do chamado selecionado — título, descrição e framework.",
          "Faça perguntas sobre o chamado e ele responde com base na base de requisitos.",
          "Também funciona como guia: pergunte 'como abro um chamado?' para ver o passo a passo.",
        ],
      },
      {
        question: "Sobre o que o Copiloto pode responder?",
        answer: [
          "Análise técnica do chamado em aberto.",
          "Requisitos de segurança e evidências dos frameworks.",
          "Passo a passo de uso da própria plataforma (modo guia).",
        ],
      },
    ],
  },
];

export default function KnowledgeBasePage() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Cabeçalho corporativo */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight text-gray-900">
              CyberITSM <span className="text-vivo">SPN</span>
            </span>
          </Link>
          <Button asChild variant="outline" size="sm" className="border-gray-300 text-gray-700">
            <Link href="/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Painel
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero + busca */}
      <section className="bg-gradient-to-br from-primary via-primary to-[#4a006e] py-14 text-white">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <BookOpen className="h-6 w-6" />
          </div>
          <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Como podemos ajudar você?
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-white/80">
            Guia interativo de uso da plataforma. Encontre respostas rápidas sobre
            chamados, identidade e assistente de IA.
          </p>

          {/* Barra de busca (apenas UI por enquanto) */}
          <div className="relative mx-auto mt-6 max-w-lg">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Pesquise por assunto ou funcionalidade..."
              className="h-11 rounded-full border-0 bg-white pl-10 text-sm shadow-lg focus-visible:ring-white/60"
            />
          </div>
        </div>
      </section>

      {/* Categorias de FAQ */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8 flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-gray-900">Guia rápido por categoria</h2>
        </div>

        <div className="space-y-6">
          {FAQ.map((category) => (
            <Card key={category.id} className="overflow-hidden border-gray-200">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-6 py-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm">
                    {category.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{category.title}</h3>
                    <p className="text-xs text-gray-500">{category.description}</p>
                  </div>
                </div>

                <Accordion type="single" collapsible className="px-6 py-2">
                  {category.items.map((item) => (
                    <AccordionItem key={item.question} value={item.question}>
                      <AccordionTrigger className="text-left text-sm font-semibold text-gray-800 hover:no-underline">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-2 pl-1 text-sm text-gray-600">
                          {item.answer.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Play className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Rodapé */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-6 py-6 text-center">
          <p className="text-sm font-semibold text-gray-800">
            Precisa de mais ajuda?
          </p>
          <p className="text-xs text-gray-500">
            Abra um chamado no Quadro Kanban ou pergunte ao Copiloto de IA na
            lateral de qualquer chamado.
          </p>
        </div>
      </footer>
    </main>
  );
}