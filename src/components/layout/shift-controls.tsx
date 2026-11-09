"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock, Coffee, Play, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { endShift, startShift, toggleBreak } from "@/server/actions/shifts";
import { formatDuration } from "@/lib/utils";
import type { Department, Shift } from "@/lib/types/database";

/**
 * The clock-in / clock-out control that lives in the top bar.
 * Shows a live timer while a shift is running.
 */
export function ShiftControls({
  activeShift,
  departments,
}: {
  activeShift: Shift | null;
  departments: Pick<Department, "id" | "name">[];
}) {
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeShift) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [activeShift]);

  if (!activeShift) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={pending}>
            <Play className="size-3.5" /> Start shift
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Clock in as…</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => startTransition(async () => {
              const r = await startShift(null);
              r.ok ? toast.success("Shift started. Stay safe out there!") : toast.error(r.error);
            })}
          >
            <Clock /> General staff
          </DropdownMenuItem>
          {departments.length > 0 && <DropdownMenuSeparator />}
          {departments.map((d) => (
            <DropdownMenuItem
              key={d.id}
              onSelect={() => startTransition(async () => {
                const r = await startShift(d.id);
                r.ok ? toast.success(`Shift started for ${d.name}.`) : toast.error(r.error);
              })}
            >
              {d.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const elapsed = now - new Date(activeShift.started_at).getTime() - activeShift.total_break_seconds * 1000;
  const onBreak = activeShift.status === "on_break";

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`hidden items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium sm:flex ${
          onBreak ? "border-warning/40 bg-warning/10 text-warning" : "border-success/40 bg-success/10 text-success"
        }`}
      >
        <span className={`size-1.5 rounded-full ${onBreak ? "bg-warning" : "bg-success animate-pulse"}`} />
        {onBreak ? "On break" : "On duty"} · {formatDuration(elapsed)}
      </span>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const r = await toggleBreak();
          r.ok ? toast.success(r.data === "on_break" ? "Break started." : "Back on duty.") : toast.error(r.error);
        })}
      >
        <Coffee className="size-3.5" /> {onBreak ? "Resume" : "Break"}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => startTransition(async () => {
          const r = await endShift();
          r.ok ? toast.success("Shift ended. Thanks for your work!") : toast.error(r.error);
        })}
      >
        <Square className="size-3.5" /> End
      </Button>
    </div>
  );
}
