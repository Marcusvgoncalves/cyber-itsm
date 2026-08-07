"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import type { User } from "@/lib/types";
import { Menu, Bell, Bot, ChevronDown, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const SecurityAgent = dynamic(
  () => import("@/components/SecurityAgent").then((mod) => mod.SecurityAgent),
  { ssr: false }
);

const ROLE_LABEL: Record<User["role"], string> = {
  admin: "Administrador",
  analista: "Analista",
  solicitante: "Solicitante",
};

interface TopbarProps {
  user: User;
  onOpenMobile: () => void;
}

export function Topbar({ user, onOpenMobile }: TopbarProps) {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Fecha os menus ao clicar fora.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = useCallback(async () => {
    const { logoutUser } = await import("@/app/actions/auth");
    await logoutUser();
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 sm:px-6">
      {/* Esquerda: hamburger (mobile) */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Abrir menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-50 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="hidden text-sm font-semibold text-gray-400 sm:block">
          Plataforma de Gestão de Segurança
        </span>
      </div>

      {/* Direita: ações globais */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* IA Copiloto */}
        <button
          type="button"
          onClick={() => setCopilotOpen((v) => !v)}
          aria-label="Abrir Copiloto de IA"
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium transition-colors sm:px-3",
            copilotOpen
              ? "bg-primary-light text-primary"
              : "text-gray-600 hover:bg-gray-50 hover:text-primary"
          )}
        >
          <Bot className="h-[18px] w-[18px]" />
          <span className="hidden md:inline">Copiloto IA</span>
        </button>

        {/* Notificações */}
        <div ref={notifRef} className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notificações"
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-50"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-vivo" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-11 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
              <p className="mb-2 text-sm font-bold text-gray-900">Notificações</p>
              <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-500">
                Nenhuma notificação no momento.
              </div>
            </div>
          )}
        </div>

        {/* Perfil */}
        <div ref={profileRef} className="relative">
          <button
            type="button"
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="Menu do usuário"
            className="flex items-center gap-2 rounded-md py-1.5 pl-1.5 pr-1.5 hover:bg-gray-50 sm:pr-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {(user.full_name || user.email).substring(0, 2).toUpperCase()}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block max-w-[140px] truncate text-sm font-semibold text-gray-900">
                {user.full_name || user.email}
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {ROLE_LABEL[user.role]}
              </span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-gray-400 sm:block" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 w-64 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
              <div className="border-b border-gray-100 px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-gray-900">{user.full_name || "Sem nome"}</p>
                <p className="truncate text-xs text-gray-500">{user.email}</p>
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary">
                  <ShieldCheck className="h-3 w-3" /> {ROLE_LABEL[user.role]}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Sair da plataforma
              </button>
            </div>
          )}
        </div>
      </div>

      {copilotOpen && (
        <SecurityAgent
          ticketData={{}}
          isOpen={copilotOpen}
          onClose={() => setCopilotOpen(false)}
          currentUser={user}
          onAction={(action) => {
            if (action === "dashboard" || action === "new-ticket") {
              router.push("/dashboard");
            }
          }}
        />
      )}
    </header>
  );
}
