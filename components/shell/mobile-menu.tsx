"use client";

import { useRouter } from "next/navigation";
import type { User } from "@/lib/types";
import { NavBrand, SidebarNav } from "./sidebar";
import { X, LogOut } from "lucide-react";

interface MobileMenuProps {
  open: boolean;
  user: User;
  onClose: () => void;
}

export function MobileMenu({ open, user, onClose }: MobileMenuProps) {
  const router = useRouter();

  if (!open) return null;

  const handleLogout = async () => {
    const { logoutUser } = await import("@/app/actions/auth");
    await logoutUser();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-gray-200 px-4">
          <NavBrand />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav user={user} />
        </div>

        {/* Rodapé do usuário */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 p-4">
          <div className="flex min-w-0 items-center gap-3">
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
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
