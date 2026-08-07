"use client";

import { useState, useEffect, type ReactNode } from "react";
import type { User } from "@/lib/types";
import { SidebarNav, NavBrand } from "./sidebar";
import { Topbar } from "./topbar";
import { MobileMenu } from "./mobile-menu";

interface AppShellProps {
  user: User;
  children: ReactNode;
}

/**
 * Shell principal da área logada (inspirado no modelo Atlassian Jira):
 * Sidebar esquerda persistente + Top bar global + Área de conteúdo.
 * No mobile, a sidebar vira hamburger menu (MobileMenu).
 */
export function AppShell({ user, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Monitoramento de inatividade/atividade no client (15 mins inatividade, 1 hora total)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };

    const setCookie = (name: string, value: string) => {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${name}=${value}; path=/; SameSite=Strict${secure}`;
    };

    const now = Date.now();
    if (!getCookie("session_start")) {
      setCookie("session_start", now.toString());
    }
    if (!getCookie("last_activity")) {
      setCookie("last_activity", now.toString());
    }

    let lastWrite = Date.now();

    // Grava o cookie no máximo a cada 10 segundos para preservar performance
    const updateActivity = () => {
      const cur = Date.now();
      if (cur - lastWrite > 10000) {
        setCookie("last_activity", cur.toString());
        lastWrite = cur;
      }
    };

    // Eventos que caracterizam "sistema em uso"
    window.addEventListener("mousemove", updateActivity);
    window.addEventListener("keydown", updateActivity);
    window.addEventListener("click", updateActivity);
    window.addEventListener("scroll", updateActivity);

    // Validação local a cada 5 segundos
    const interval = setInterval(async () => {
      const current = Date.now();
      const sessionStartVal = getCookie("session_start");
      const lastActivityVal = getCookie("last_activity");

      const sessionStart = sessionStartVal ? parseInt(sessionStartVal, 10) : current;
      const lastActivity = lastActivityVal ? parseInt(lastActivityVal, 10) : current;

      const oneHourMs = 60 * 60 * 1000;
      const fifteenMinutesMs = 15 * 60 * 1000;

      if (current - sessionStart > oneHourMs || current - lastActivity > fifteenMinutesMs) {
        console.log("[Client Session] Limite de tempo excedido. Executando logoff automático...");
        clearInterval(interval);
        
        const { logoutUser } = await import("@/app/actions/auth");
        await logoutUser();
        window.location.href = "/login?session_expired=true";
      }
    }, 5000);

    return () => {
      window.removeEventListener("mousemove", updateActivity);
      window.removeEventListener("keydown", updateActivity);
      window.removeEventListener("click", updateActivity);
      window.removeEventListener("scroll", updateActivity);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar desktop (persistente) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-gray-200 px-5">
          <NavBrand />
        </div>
        <SidebarNav user={user} />
        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center gap-3 rounded-md bg-gray-50 p-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {(user.full_name || user.email).substring(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{user.full_name || user.email}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {user.role === "admin" ? "Administrador" : user.role === "analista" ? "Analista" : "Solicitante"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Menu mobile (drawer) */}
      <MobileMenu open={mobileOpen} user={user} onClose={() => setMobileOpen(false)} />

      {/* Coluna principal */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
