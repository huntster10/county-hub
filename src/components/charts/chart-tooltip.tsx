"use client";

/**
 * Shared tooltip for every Recharts chart so they all look the same.
 * Pass `formatter` to change how values are displayed (e.g. minutes → "2h 10m").
 */
export interface TooltipPayloadItem {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-lg">
      {label !== undefined && <p className="mb-1 font-medium text-foreground">{String(label)}</p>}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2 rounded-sm" style={{ background: p.color }} />
            <span className="flex-1">{String(p.name ?? p.dataKey)}</span>
            <span className="font-medium text-foreground">
              {formatter ? formatter(Number(p.value), String(p.name ?? p.dataKey)) : String(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

export { minutesLabel } from "@/lib/utils";
