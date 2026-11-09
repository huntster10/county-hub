import { Clock, Users, ShieldCheck, Gavel } from "lucide-react";
import { minutesLabel } from "@/lib/utils";
import type { DashboardData } from "@/lib/data/dashboard";

/** The KPI row at the very top of the dashboard. */
export function StatTiles({ stats, staff }: { stats: DashboardData["stats"]; staff: boolean }) {
  const tiles = [
    { label: "On duty now", value: String(stats.activeStaff), icon: ShieldCheck, hint: "staff clocked in" },
    { label: "Hours today", value: minutesLabel(stats.minutesToday), icon: Clock, hint: "across all staff" },
    { label: "Hours this week", value: minutesLabel(stats.minutesWeek), icon: Clock, hint: "last 7 days" },
    staff
      ? { label: "Punishments", value: String(stats.punishmentsWeek), icon: Gavel, hint: "last 7 days" }
      : { label: "Members", value: String(stats.membersTotal), icon: Users, hint: "registered" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <t.icon className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-semibold leading-none">{t.value}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{t.hint}</p>
        </div>
      ))}
    </div>
  );
}
