"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, minutesLabel } from "@/components/charts/chart-tooltip";
import type { DashboardData } from "@/lib/data/dashboard";

/** 14-day staff activity (total shift minutes per day). */
export function ActivityChartWidget({ data }: { data: DashboardData["activityByDay"] }) {
  // Fill in days with no shifts so the x-axis is continuous.
  const days: { day: string; label: string; minutes: number; staff: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = data.find((r) => r.day === key);
    days.push({
      day: key,
      label: d.toLocaleDateString([], { month: "short", day: "numeric" }),
      minutes: row?.total_minutes ?? 0,
      staff: row?.unique_staff ?? 0,
    });
  }
  const total = days.reduce((a, d) => a + d.minutes, 0);

  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-2xl font-semibold leading-none">
        {minutesLabel(total)} <span className="text-xs font-normal text-muted-foreground">on duty in the last 14 days</span>
      </p>
      <div className="min-h-[180px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={days} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval={2} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${Math.round(v / 60)}h`} />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              content={<ChartTooltip formatter={(v) => minutesLabel(v)} />}
            />
            <Area type="monotone" dataKey="minutes" name="Time on duty" stroke="var(--chart-1)" strokeWidth={2} fill="url(#activityFill)" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Busiest day: {(() => { const best = days.reduce((a, d) => (d.minutes > a.minutes ? d : a), days[0]); return `${best.label} (${minutesLabel(best.minutes)}, ${best.staff} staff)`; })()}
      </p>
    </div>
  );
}
