"use client";

import { useState, useRef, useEffect, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, X, Send, User as UserIcon, ShieldAlert, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function AiChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou seu **Agente de IA SecOps**. Como posso ajudar na análise de riscos ou conformidade dos seus tickets hoje?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (response.ok) {
        const assistantMsg = await response.json();
        setMessages(prev => [...prev, assistantMsg]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro ao contactar o servidor SecOps.',
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erro de rede ao contactar o Agente.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to render simple markdown (bold and line breaks) securely in React
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return (
      <span>
        {lines.map((line, lineIndex) => {
          const boldParts = line.split(/\*\*(.*?)\*\*/g);
          const renderedLine = boldParts.map((part, partIndex) => {
            if (partIndex % 2 === 1) {
              const italicParts = part.split(/\*(.*?)\*/g);
              return (
                <strong key={partIndex}>
                  {italicParts.map((subPart, subPartIndex) => 
                    subPartIndex % 2 === 1 ? <em key={subPartIndex}>{subPart}</em> : subPart
                  )}
                </strong>
              );
            } else {
              const italicParts = part.split(/\*(.*?)\*/g);
              return (
                <Fragment key={partIndex}>
                  {italicParts.map((subPart, subPartIndex) => 
                    subPartIndex % 2 === 1 ? <em key={subPartIndex}>{subPart}</em> : subPart
                  )}
                </Fragment>
              );
            }
          });
          
          return (
            <Fragment key={lineIndex}>
              {renderedLine}
              {lineIndex < lines.length - 1 && <br />}
            </Fragment>
          );
        })}
      </span>
    );
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary hover:bg-primary-hover text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 z-40 ${isOpen ? 'scale-0' : 'scale-100'}`}
        aria-label="Abrir Agente SecOps IA"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-[380px] h-[550px] shadow-2xl flex flex-col overflow-hidden z-50 border-0 ring-1 ring-black/5 animate-fadeIn">
          {/* Header */}
          <div className="bg-primary text-white p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-lg">
                <ShieldAlert className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide">Agente SecOps IA</h3>
                <p className="text-[10px] text-white/80">Especialista em Frameworks de Segurança</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm ${msg.role === 'user' ? 'bg-gray-200 text-gray-700' : 'bg-vivo text-white'}`}>
                  {msg.role === 'user' ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
                
                {/* Message Bubble */}
                <div className={`flex flex-col max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white rounded-tr-sm' 
                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'
                  }`}>
                    {renderMarkdown(msg.content)}
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 flex-row">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-vivo text-white flex items-center justify-center shadow-sm">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-100">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex: Como tratar falhas de senha?"
                className="flex-1 bg-gray-50 border-gray-200 focus-visible:ring-primary h-10 text-sm"
                disabled={isLoading}
              />
              <Button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="h-10 w-10 p-0 rounded-full bg-primary hover:bg-primary-hover flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      )}
    </>
  );
}
