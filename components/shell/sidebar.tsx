"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";
import type { User } from "@/lib/types";
import { NAV_GROUPS, buildHref, isNavItemActive, type NavItem } from "./nav-items";

export function NavBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
        <ShieldAlert className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="text-base font-bold tracking-tight text-gray-900">
          CyberITSM <span className="text-vivo">SPN</span>
        </span>
      )}
    </Link>
  );
}

function NavLinks({ user }: { user: User }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const isAdmin = user.role === "admin";

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin);
        if (visibleItems.length === 0) return null;
        return (
          <div key={group.title}>
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {visibleItems.map((item) => (
                <NavLinkItem key={item.label} item={item} active={isNavItemActive(item, pathname, tab)} />
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function NavLinkItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={buildHref(item)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-primary-light text-primary"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "text-gray-400")} />
        <span className="truncate">{item.label}</span>
      </Link>
    </li>
  );
}

export function SidebarNav({ user }: { user: User }) {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <NavLinks user={user} />
    </Suspense>
  );
}
