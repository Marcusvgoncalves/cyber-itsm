"use client";

import { useState, type ReactNode } from "react";
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
