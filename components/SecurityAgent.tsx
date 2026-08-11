"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, X, Send, User as UserIcon, ShieldAlert, Loader2, ArrowRight, LayoutDashboard, PlusCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface TicketData {
  id?: string;
  title?: string;
  description?: string | null;
  framework_origem?: string | null;
  dominio_framework?: string | null;
  priority?: string;
  tags?: string[];
}

/** Ação de navegação disparada pelos botões do chat. */
export type AgentAction = "dashboard" | "new-ticket";

import type { User } from "@/lib/types";

interface SecurityAgentProps {
  ticketData: TicketData;
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User;
  /** Callback para o botão de ação navegar para outra área do painel. */
  onAction?: (action: AgentAction) => void;
}

const WELCOME_MESSAGE =
  "Sou o Copiloto de Security QA. Posso explicar o fluxo da plataforma (upload .json/.xml/.txt, cruzamento com CYBER.SEGURA.*, cálculo de conformidade e arquivamento GZIP) e responder dúvidas técnicas de cibersegurança (SQLi, BOLA, XSS, HSTS, criptografia e remediações OWASP/NIST).";

const GUIDE_KEYWORDS = [
  "passo a passo",
  "como usar",
  "como abro",
  "como crio",
  "como faço",
  "como acesso",
  "novo chamado",
  "dashboard",
  "dashboards",
  "abrir um chamado",
  "guia",
  "sugest",
  "onde vejo",
  "como utilizo",
];

/** Detecta se a resposta do assistente é um guia de uso da plataforma. */
function isGuideReply(text: string): boolean {
  const lower = text.toLowerCase();
  return GUIDE_KEYWORDS.some((k) => lower.includes(k));
}

/**
 * Extrai a seção "Sugestões:" de uma resposta no modo guia.
 * Formato esperado (instruído no system prompt):
 *   Sugestões:
 *   # Pergunta de acompanhamento 1
 *   # Pergunta de acompanhamento 2
 */
function extractFollowUps(text: string): string[] {
  const lines = text.split("\n");
  const followUps: string[] = [];
  let inSuggestions = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (/^Sugest[oõ]es:/i.test(line)) {
      inSuggestions = true;
      continue;
    }
    if (inSuggestions) {
      if (line.startsWith("#") && line.length > 1) {
        followUps.push(line.replace(/^#\s*/, "").trim());
      } else if (line !== "") {
        break;
      }
    }
  }

  return followUps;
}

/**
 * Extrai o texto de uma UIMessage (parts[0] type='text').
 */
function getMessageText(message: { parts: Array<{ type: string; text?: string }> }): string {
  const textPart = message.parts.find((p) => p.type === "text");
  return textPart?.text ?? "";
}

// Estilo dos elementos markdown renderizados pelo Copiloto.
const MARKDOWN_COMPONENTS = {
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal space-y-1 pl-5">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-2 mt-3 text-base font-bold first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-2 mt-3 text-sm font-bold first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-3 text-[13px] font-bold first:mt-0">{children}</h3>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-gray-100 px-1 py-0.5 text-[12px] font-mono text-red-600">
      {children}
    </code>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-gray-200 pl-3 italic text-gray-500">
      {children}
    </blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-gray-200 px-2 py-1">{children}</td>
  ),
};

export function SecurityAgent({ ticketData, isOpen, onClose, currentUser, onAction }: SecurityAgentProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");

  const ticketContext = useMemo(
    () =>
      JSON.stringify({
        id: ticketData.id ?? null,
        title: ticketData.title ?? null,
        description: ticketData.description ?? null,
        framework_origem: ticketData.framework_origem ?? null,
        dominio_framework: ticketData.dominio_framework ?? null,
        priority: ticketData.priority ?? null,
        tags: Array.isArray(ticketData.tags) ? ticketData.tags : [],
      }),
    [ticketData]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { ticketContext },
        credentials: "same-origin",
      }),
    [ticketContext]
  );

  // Histórico de chat persistido no localStorage (isolado por ID do usuário)
  const localStorageKey = useMemo(() => {
    return currentUser?.id 
      ? `cyberitsm_secops_chat_messages_${currentUser.id}` 
      : "cyberitsm_secops_chat_messages_guest";
  }, [currentUser]);

  const { messages, status, sendMessage, error, setMessages } = useChat({
    transport,
  });

  // Carrega o histórico ao montar o componente ou quando a chave mudar
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(localStorageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
          }
        } catch (e) {
          console.error("Erro ao recuperar histórico do chat:", e);
        }
      }
    }
  }, [localStorageKey, setMessages]);

  // Salva no localStorage sempre que as mensagens mudam
  useEffect(() => {
    if (typeof window !== "undefined" && messages && messages.length > 0) {
      localStorage.setItem(localStorageKey, JSON.stringify(messages));
    }
  }, [messages, localStorageKey]);

  const isLoading = status === "streaming" || status === "submitted";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const text = inputValue.trim();
    setInputValue("");
    await sendMessage({ text });
  };

  const handleQuickGuide = async () => {
    if (isLoading) return;
    setInputValue("");
    await sendMessage({ text: "Como usar o ITSM?" });
  };

  const handleFollowUp = async (text: string) => {
    if (isLoading) return;
    await sendMessage({ text });
  };

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAssistantText = lastAssistant ? getMessageText(lastAssistant) : "";
  const isGuideMode = lastAssistant ? isGuideReply(lastAssistantText) : false;
  const followUps = lastAssistant ? extractFollowUps(lastAssistantText) : [];

  if (!isOpen) return null;

  return (
    <Card className="fixed bottom-4 right-4 z-50 flex h-[560px] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-primary px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-white">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Copiloto de Security QA</h2>
            <p className="text-[10px] text-white/80">FAQ da plataforma · Análise técnica (OWASP/NIST)</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Fechar o agente"
          className="h-8 w-8 rounded-md text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Contexto do chamado (resumo) */}
      <div className="border-b border-gray-200 bg-amber-50/70 px-4 py-2">
        <p className="line-clamp-2 text-[11px] leading-snug text-gray-600">
          <span className="font-semibold text-amber-800">Contexto: </span>
          {ticketData.id ? `SPN-${String(ticketData.id).slice(-6).toUpperCase()} · ` : ""}
          {ticketData.title || "Alterar seleção do chamado."}
          {ticketData.framework_origem ? ` (${ticketData.framework_origem})` : ""}
        </p>
      </div>

      {/* Mensagens */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-gray-50/60 p-4">
        {messages.length === 0 ? (
          <div className="flex items-start gap-3 rounded-2xl rounded-tl-sm border border-gray-100 bg-white px-4 py-2.5 text-[13px] text-gray-700 shadow-sm">
            <Bot className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
            <p>{WELCOME_MESSAGE}</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isLastAssistant = idx === messages.length - 1 && msg.role === "assistant";
            return (
              <div key={msg.id}>
                <div
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full shadow-sm ${
                      msg.role === "user"
                        ? "bg-gray-200 text-gray-700"
                        : "bg-primary text-white"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <UserIcon className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`flex max-w-[78%] flex-col ${
                      msg.role === "user" ? "items-end" : "items-start"
                    }`}
                  >
                  <div
                    data-testid={msg.role === "user" ? "user-bubble" : "assistant-bubble"}
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "rounded-tr-sm bg-primary text-white"
                        : "rounded-tl-sm border border-gray-100 bg-white text-gray-800"
                    }`}
                  >
                    {msg.role === "user" ? (
                      getMessageText(msg)
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                        {getMessageText(msg)}
                      </ReactMarkdown>
                    )}
                  </div>
                  </div>
                </div>

                {/* Botões de ação + follow-ups do modo guia */}
                {isLastAssistant && (isGuideMode || followUps.length > 0) && !isLoading && (
                  <div className="ml-10 mt-3 space-y-2.5">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={() => onAction?.("new-ticket")}
                        className="gap-1.5 rounded-full text-xs"
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        Novo Chamado
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onAction?.("dashboard")}
                        className="gap-1.5 rounded-full border-gray-300 text-xs"
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        Ir para Dashboards
                      </Button>
                    </div>

                    {followUps.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          Próximos passos:
                        </p>
                        {followUps.map((followUp) => (
                          <button
                            key={followUp}
                            type="button"
                            onClick={() => handleFollowUp(followUp)}
                            disabled={isLoading}
                            className="flex w-full items-center justify-between gap-2 rounded-full border border-primary/20 bg-primary-light px-3 py-1.5 text-left text-xs text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                          >
                            <span className="line-clamp-2">{followUp}</span>
                            <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex items-center gap-2 py-1">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-gray-400">Analisando contexto...</span>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
            Erro ao processar a solicitação. Tente novamente.
            {error instanceof Error ? ` (${error.message})` : typeof error === "string" ? ` (${error})` : ""}
          </p>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Entrada */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 bg-white p-3">
        {/* Atalho rápido de guia de uso */}
        <button
          type="button"
          onClick={handleQuickGuide}
          disabled={isLoading}
          className="mb-2 flex w-full items-center gap-2 rounded-full border border-primary/20 bg-primary-light px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          <span className="text-sm leading-none">💡</span>
          Como usar o ITSM?
        </button>

        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Pergunte sobre o chamado..."
            disabled={isLoading}
            className="h-10 flex-1 bg-gray-50 text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || isLoading}
            aria-label="Enviar mensagem"
            className="h-10 w-10 flex-shrink-0 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </Card>
  );
}