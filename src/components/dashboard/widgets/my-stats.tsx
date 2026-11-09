"use client";

import { Target } from "lucide-react";
import { minutesLabel } from "@/components/charts/chart-tooltip";

/** The signed-in user's hours this week against the community quota. */
export function MyStatsWidget({ minutesWeek, quota }: { minutesWeek: number; quota: number }) {
  const pct = quota > 0 ? Math.min(100, Math.round((minutesWeek / quota) * 100)) : null;
  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div>
        <p className="text-3xl font-semibold leading-none">{minutesLabel(minutesWeek)}</p>
        <p className="mt-1 text-xs text-muted-foreground">on duty in the last 7 days</p>
      </div>
      {pct !== null ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Target className="size-3" /> Weekly quota: {minutesLabel(quota)}</span>
            <span className={pct >= 100 ? "font-medium text-success" : ""}>{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className={`h-full rounded-full ${pct >= 100 ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {pct >= 100 ? "Quota met — nice work!" : `${minutesLabel(Math.max(0, quota - minutesWeek))} to go this week.`}
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">No weekly quota is set. Admins can set one under Settings.</p>
      )}
    </div>
  );
}
