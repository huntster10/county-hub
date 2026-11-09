"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasRoleAtLeast, isStaff } from "@/lib/permissions";
import type { AppRole, Department } from "@/lib/types/database";
import { NAV_SECTIONS } from "./nav-config";
import { DeptIcon } from "@/components/shared/dept-icon";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SidebarProps {
  role: AppRole;
  communityName: string;
  departments: Pick<Department, "id" | "name" | "slug" | "color" | "icon">[];
  unreadTotal: number;
  onNavigate?: () => void;
}

export function Sidebar({ role, communityName, departments, unreadTotal, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Brand */}
      <Link href="/dashboard" onClick={onNavigate} className="flex h-14 items-center gap-2.5 border-b px-4">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Radio className="size-4" />
        </span>
        <span className="truncate text-sm font-semibold text-foreground">{communityName}</span>
      </Link>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-6">
          {NAV_SECTIONS.map((section) => {
            const items = section.items.filter((item) => {
              if (item.staffOnly && !isStaff(role)) return false;
              if (item.minRole && !hasRoleAtLeast(role, item.minRole)) return false;
              return true;
            });
            if (items.length === 0) return null;
            return (
              <div key={section.title}>
                <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {section.title}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          className={cn(
                            "group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                            active
                              ? "bg-accent text-foreground shadow-[inset_2px_0_0_0_var(--primary)]"
                              : "text-sidebar-foreground hover:bg-accent/60 hover:text-foreground",
                          )}
                        >
                          <item.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.href === "/messages" && unreadTotal > 0 && (
                            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
                              {unreadTotal > 99 ? "99+" : unreadTotal}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {departments.length > 0 && (
            <div>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Your departments
              </p>
              <ul className="space-y-0.5">
                {departments.map((d) => {
                  const href = `/departments/${d.slug}`;
                  const active = isActive(href);
                  return (
                    <li key={d.id}>
                      <Link
                        href={href}
                        onClick={onNavigate}
                        className={cn(
                          "group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors",
                          active ? "bg-accent text-foreground" : "hover:bg-accent/60 hover:text-foreground",
                        )}
                      >
                        <span
                          className="flex size-5 items-center justify-center rounded-md"
                          style={{ backgroundColor: `${d.color}26`, color: d.color }}
                        >
                          <DeptIcon name={d.icon} className="size-3" />
                        </span>
                        <span className="truncate">{d.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </nav>
      </ScrollArea>

      <div className="border-t p-3 text-[11px] text-muted-foreground">
        Press <kbd className="rounded border bg-muted px-1 font-mono">Ctrl</kbd>+<kbd className="rounded border bg-muted px-1 font-mono">K</kbd> to jump anywhere
      </div>
    </div>
  );
}
