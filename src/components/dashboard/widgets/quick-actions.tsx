"use client";

import Link from "next/link";
import { useTransition } from "react";
import { MessageSquare, Gavel, Siren, Play, Square, Radar, CalendarClock, Terminal } from "lucide-react";
import { toast } from "sonner";
import { endShift, startShift } from "@/server/actions/shifts";
import { isStaff } from "@/lib/permissions";
import type { AppRole } from "@/lib/types/database";

export function QuickActionsWidget({ role, hasActiveShift }: { role: AppRole; hasActiveShift: boolean }) {
  const [pending, startTransition] = useTransition();
  const staff = isStaff(role);

  const shiftAction = () =>
    startTransition(async () => {
      const r = hasActiveShift ? await endShift() : await startShift(null);
      r.ok ? toast.success(hasActiveShift ? "Shift ended." : "Shift started.") : toast.error(r.error);
    });

  const actions = [
    {
      label: hasActiveShift ? "End shift" : "Start shift",
      icon: hasActiveShift ? Square : Play,
      onClick: shiftAction,
      tone: hasActiveShift ? "text-destructive" : "text-success",
    },
    { label: "Open messages", icon: MessageSquare, href: "/messages", tone: "text-primary" },
    { label: "New CAD call", icon: Siren, href: "/cad?new=1", tone: "text-chart-2" },
    { label: "Sessions", icon: CalendarClock, href: "/sessions", tone: "text-chart-7" },
    ...(staff
      ? [
          { label: "Log punishment", icon: Gavel, href: "/staff/punishments?new=1", tone: "text-chart-8" },
          { label: "Live players", icon: Radar, href: "/staff/players", tone: "text-chart-3" },
          { label: "Run command", icon: Terminal, href: "/staff/players?command=1", tone: "text-chart-4" },
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {actions.map((a) => {
        const inner = (
          <>
            <a.icon className={`size-4 ${a.tone}`} />
            <span className="text-xs font-medium">{a.label}</span>
          </>
        );
        const cls =
          "flex h-16 flex-col items-center justify-center gap-1.5 rounded-lg border bg-background/40 transition-colors hover:border-primary/40 hover:bg-accent disabled:opacity-50";
        return "href" in a && a.href ? (
          <Link key={a.label} href={a.href} className={cls}>{inner}</Link>
        ) : (
          <button key={a.label} onClick={a.onClick} disabled={pending} className={cls}>{inner}</button>
        );
      })}
    </div>
  );
}
