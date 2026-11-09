"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, minutesLabel } from "@/components/charts/chart-tooltip";

export function LeaderboardChart({ rows, quota }: { rows: { roblox_username: string; total_minutes: number }[]; quota: number }) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap={6}>
          <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${Math.round(v / 60)}h`} />
          <YAxis type="category" dataKey="roblox_username" width={100} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <Tooltip cursor={{ fill: "var(--accent)" }} content={<ChartTooltip formatter={(v) => minutesLabel(v)} />} />
          {quota > 0 && <ReferenceLine x={quota} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: "quota", fill: "var(--warning)", fontSize: 10, position: "insideTopRight" }} />}
          <Bar dataKey="total_minutes" name="On duty" radius={[0, 4, 4, 0]} maxBarSize={16}>
            {rows.map((r) => <Cell key={r.roblox_username} fill={r.total_minutes >= quota && quota > 0 ? "var(--chart-3)" : "var(--chart-1)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
