"use client";

import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { Gavel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardData } from "@/lib/data/dashboard";
import type { PunishmentType } from "@/lib/types/database";

export const PUNISHMENT_VARIANT: Record<PunishmentType, "default" | "destructive" | "warning" | "secondary" | "success"> = {
  warning: "warning",
  kick: "default",
  ban: "destructive",
  note: "secondary",
  bolo: "success",
};

export function RecentPunishmentsWidget({ rows }: { rows: DashboardData["recentPunishments"] }) {
  if (rows.length === 0) {
    return <EmptyState icon={Gavel} title="No punishments logged" description="Warnings, kicks and bans will show up here." className="border-0 p-6" />;
  }
  return (
    <ul className="divide-y divide-border/60">
      {rows.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
          <Badge variant={PUNISHMENT_VARIANT[p.type]} className="w-16 justify-center uppercase">{p.type}</Badge>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              <span className="font-medium">{p.target_username}</span>
              <span className="text-muted-foreground"> — {p.reason}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">
              by {p.moderator?.roblox_username ?? "unknown"} · {formatDistanceToNowStrict(new Date(p.created_at), { addSuffix: true })}
            </p>
          </div>
        </li>
      ))}
      <li className="pt-2 text-right">
        <Link href="/staff/punishments" className="text-xs text-primary hover:underline">View all →</Link>
      </li>
    </ul>
  );
}
