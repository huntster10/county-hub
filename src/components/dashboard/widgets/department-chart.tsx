"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, minutesLabel } from "@/components/charts/chart-tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";
import type { DashboardData } from "@/lib/data/dashboard";

/** Shift minutes per department this week, as a horizontal bar chart. */
export function DepartmentChartWidget({ data }: { data: DashboardData["departmentActivity"] }) {
  if (data.length === 0) {
    return <EmptyState icon={Building2} title="No departments yet" className="border-0 p-6" />;
  }
  const rows = [...data].sort((a, b) => b.total_minutes - a.total_minutes);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-[180px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 0 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `${Math.round(v / 60)}h`} />
            <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <Tooltip cursor={{ fill: "var(--accent)" }} content={<ChartTooltip formatter={(v) => minutesLabel(v)} />} />
            <Bar dataKey="total_minutes" name="Time on duty" radius={[0, 4, 4, 0]} maxBarSize={18}>
              {rows.map((r) => (
                <Cell key={r.department_id} fill={r.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        {rows.map((r) => (
          <li key={r.department_id} className="flex items-center justify-between text-muted-foreground">
            <Link href={`/departments`} className="flex items-center gap-1.5 truncate hover:text-foreground">
              <span className="size-2 rounded-sm" style={{ background: r.color }} />
              <span className="truncate">{r.name}</span>
            </Link>
            <span>{r.members} members</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
