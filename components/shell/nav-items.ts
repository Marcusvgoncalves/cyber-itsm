import {
  Kanban,
  ShieldCheck,
  Users,
  BookOpen,
  ScrollText,
  Network,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** Caminho base (sem query string). */
  path: string;
  /** Aba ativa dentro do /dashboard (quando path === '/dashboard'). */
  tab?: string;
  label: string;
  icon: LucideIcon;
  /** Visível apenas para administradores. */
  adminOnly?: boolean;
  /** Item ativo por prefixo (ex.: /security-qa e sub-rotas). */
  matchPrefix?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Navegação global (sidebar desktop + menu mobile). */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { path: "/dashboard", tab: "kanban", label: "Quadro Kanban", icon: Kanban },
      { path: "/security-qa", label: "Security QA", icon: ShieldCheck, matchPrefix: true },
      { path: "/dashboard", tab: "iam", label: "Portal IAM / IGA", icon: Users },
      { path: "/knowledge-base", label: "Base de Conhecimento", icon: BookOpen },
    ],
  },
  {
    title: "Governança",
    items: [
      { path: "/dashboard", tab: "audit", label: "Audit Logs", icon: ScrollText, adminOnly: true },
      { path: "/dashboard", tab: "architecture", label: "Arquitetura C4", icon: Network, adminOnly: true },
    ],
  },
  {
    title: "Sistema",
    items: [{ path: "/dashboard", tab: "settings", label: "Configurações", icon: Settings }],
  },
];

export function buildHref(item: NavItem): string {
  return item.tab ? `${item.path}?tab=${item.tab}` : item.path;
}

export function isNavItemActive(
  item: NavItem,
  pathname: string,
  tab: string | null
): boolean {
  if (item.path === "/dashboard") {
    if (pathname !== "/dashboard") return false;
    const currentTab = tab ?? "kanban";
    return currentTab === (item.tab ?? "kanban");
  }
  if (item.matchPrefix) return pathname.startsWith(item.path);
  return pathname === item.path;
}
