"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { deleteShift } from "@/server/actions/shifts";
import { formatDuration } from "@/lib/utils";
import type { Shift, ShiftBreak } from "@/lib/types/database";

export type ShiftRow = Shift & {
  profile: { id: string; roblox_username: string; roblox_display_name: string | null; avatar_url: string | null };
  department: { name: string; color: string } | null;
  breaks: ShiftBreak[];
};

export function ShiftsTable({ rows, mine, canDelete }: { rows: ShiftRow[]; mine: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [now] = useState(() => Date.now());

  const duration = (s: ShiftRow) => {
    const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
    return Math.max(0, end - new Date(s.started_at).getTime() - s.total_break_seconds * 1000);
  };
  const totalMs = rows.reduce((a, s) => a + duration(s), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={mine ? "mine" : "all"} onValueChange={(v) => router.push(v === "mine" ? "/staff/shifts?mine=1" : "/staff/shifts")}>
          <TabsList>
            <TabsTrigger value="all">All staff</TabsTrigger>
            <TabsTrigger value="mine">My shifts</TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs text-muted-foreground">{rows.length} shifts · {formatDuration(totalMs)} total (last 200)</p>
      </div>

      <div className="rounded-xl border bg-card">
        {rows.length === 0 ? (
          <EmptyState icon={Clock} title="No shifts yet" description="Use “Start shift” in the top bar to clock in." className="m-3" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff member</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Ended</TableHead>
                <TableHead>Breaks</TableHead>
                <TableHead className="text-right">On duty</TableHead>
                {canDelete && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <UserAvatar username={s.profile.roblox_username} avatarUrl={s.profile.avatar_url} className="size-7" />
                      <Link href={`/members/${s.profile.id}`} className="text-sm font-medium hover:underline">{s.profile.roblox_display_name ?? s.profile.roblox_username}</Link>
                      {s.status !== "ended" && <Badge variant={s.status === "on_break" ? "warning" : "success"}>{s.status === "on_break" ? "On break" : "Live"}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.department ? <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: s.department.color }} />{s.department.name}</span> : <span className="text-muted-foreground">General</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(s.started_at), "MMM d, p")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.ended_at ? format(new Date(s.ended_at), "MMM d, p") : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{s.breaks.length ? `${s.breaks.length} · ${formatDuration(s.total_break_seconds * 1000)}` : "—"}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatDuration(duration(s))}</TableCell>
                  {canDelete && (
                    <TableCell>
                      <Button variant="ghost" size="icon-sm" className="text-destructive" disabled={pending} onClick={() => confirm("Delete this shift record?") && start(async () => { const r = await deleteShift(s.id); if (r.ok) { toast.success("Shift deleted"); router.refresh(); } else toast.error(r.error); })}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
