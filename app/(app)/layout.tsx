import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/supabase";
import { AppShell } from "@/components/shell/app-shell";

/**
 * Layout da área autenticada (route group (app)).
 * Todos os módulos — dashboard, security-qa, knowledge-base — são
 * renderizados dentro do shell (sidebar + topbar) mantendo a navegação
 * sempre visível.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return <AppShell user={user}>{children}</AppShell>;
}
