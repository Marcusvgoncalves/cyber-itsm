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
  ArrowRight,
  BookOpen,
  Download,
  Layers,
  Play,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { InteractiveRequirementsCatalog } from "@/components/knowledge-base/interactive-requirements";

interface FaqEntry {
  question: string;
  answer: string[];
  /** Links internos reais (next/link) para as funcionalidades citadas. */
  links?: { label: string; href: string }[];
  /** Links externos reais (âncora target="_blank") para a documentação oficial. */
  externalLinks?: { label: string; href: string }[];
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
        links: [{ label: "Abrir Quadro Kanban", href: "/dashboard" }],
      },
      {
        question: "Como navego entre as principais áreas do painel?",
        answer: [
          "Use o menu superior do Painel para alternar entre as áreas.",
          "'Quadro Kanban': gerencie os chamados em etapas.",
          "Portal IAM/IGA: aprovações, provisionamento e gestão de identidade.",
          "Audit Logs: rastreabilidade das ações (somente administradores).",
        ],
        links: [{ label: "Acessar o Painel", href: "/dashboard" }],
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
        question: "Como acompanho o status dos meus chamados?",
        answer: [
          "O Quadro Kanban utiliza o modelo hierárquico com 3 níveis: Épico (macro demanda), Atividade e Tarefa.",
          "Cada coluna representa um estado estrito: Aberto, Em Andamento, Bloqueado, Fechado e Cancelado.",
          "Existem regras de transição (ex: um chamado não pode pular de Aberto direto para Fechado sem passar por Em Andamento).",
          "Atenção aos Épicos: você só pode mover um Épico para 'Fechado' se todas as suas Atividades e Tarefas filhas também estiverem Fechadas ou Canceladas.",
        ],
        links: [{ label: "Acompanhar meus chamados", href: "/dashboard" }],
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
        links: [{ label: "Abrir o Painel e conversar com o Copiloto", href: "/dashboard" }],
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
  {
    id: "frameworks-seguranca",
    title: "Frameworks de Segurança",
    description: "Referências oficiais dos principais frameworks de cibersegurança.",
    icon: <ShieldCheck className="h-5 w-5 text-success" />,
    items: [
      {
        question: "OWASP Top 10",
        answer: [
          "Ranking dos dez riscos de segurança mais críticos em aplicações web, atualizado pela OWASP Foundation.",
          "Serve como base para priorizar correções (Injeção, Broken Access Control, XSS, SSRF, etc.).",
        ],
        externalLinks: [
          { label: "Documentação Oficial OWASP Top 10", href: "https://owasp.org/www-project-top-ten/" },
        ],
      },
      {
        question: "NIST CSF",
        answer: [
          "Framework do NIST (EUA) para gestão e redução de risco de cibersegurança, organizado em cinco funções: Identificar, Proteger, Detectar, Responder e Recuperar.",
          "Amplamente usado como base para programas corporativos e requisitos normativos.",
        ],
        externalLinks: [
          { label: "Documentação Oficial NIST CSF", href: "https://www.nist.gov/cyberframework" },
        ],
      },
      {
        question: "CIS Controls",
        answer: [
          "Conjunto priorizado de 18 controles práticos (Center for Internet Security) para defesa contra ataques conhecidos.",
          "Ideal para definir quick wins de hardening e medir maturidade operacional.",
        ],
        externalLinks: [
          { label: "Documentação Oficial CIS Controls", href: "https://www.cisecurity.org/controls" },
        ],
      },
      {
        question: "ISO/IEC 27001",
        answer: [
          "Norma internacional para Sistemas de Gestão de Segurança da Informação (SGSI).",
          "Define requisitos para implantar, monitorar e melhorar continuamente controles de segurança.",
        ],
        externalLinks: [
          { label: "Documentação Oficial ISO/IEC 27001", href: "https://www.iso.org/standard/27001" },
        ],
      },
    ],
  },
];

export default function KnowledgeBasePage() {
  return (
    <div className="bg-gray-50">
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
              className="h-11 rounded-full border-0 bg-white pl-10 text-sm text-gray-900 placeholder:text-gray-400 shadow-lg focus-visible:ring-white/60"
            />
          </div>
        </div>
      </section>

      {/* Destaque: Guia de Uso (PDF) */}
      <section className="mx-auto -mt-6 max-w-5xl px-6">
        <Card className="overflow-hidden border-0 bg-white shadow-lg ring-1 ring-primary/10">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                <Download className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Guia de Uso da Plataforma</h3>
                <p className="mt-0.5 max-w-md text-sm text-gray-500">
                  Manual completo em PDF com todas as funcionalidades do CyberITSM
                  SPN: chamados, identidade e esteira DevSecOps.
                </p>
              </div>
            </div>
            <a
              href="/docs/guia-uso.pdf"
              download
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-white shadow-md transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Download className="h-4 w-4" />
              Baixar Guia de Uso (PDF)
            </a>
          </CardContent>
        </Card>
      </section>

      {/* Catálogo Interativo dos 314 Requisitos de Segurança */}
      <InteractiveRequirementsCatalog />

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
                        {item.links && item.links.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.links.map((link) => (
                              <Button asChild key={link.href} variant="outline" size="sm" className="gap-1.5 border-primary/30 text-primary hover:bg-primary-light">
                                <Link href={link.href}>
                                  <ArrowRight className="h-3.5 w-3.5" />
                                  {link.label}
                                </Link>
                              </Button>
                            ))}
                          </div>
                        )}
                        {item.externalLinks && item.externalLinks.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.externalLinks.map((link) => (
                              <a
                                key={link.href}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary-light"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                                {link.label}
                              </a>
                            ))}
                          </div>
                        )}
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
    </div>
  );
}