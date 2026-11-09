"use client";

import Link from "next/link";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Session } from "@/lib/types/database";

export function SessionsWidget({ sessions, canManage }: { sessions: Session[]; canManage: boolean }) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No sessions scheduled"
        description="Plan the next roleplay session so members know when to show up."
        action={canManage ? <Button asChild size="sm" variant="outline"><Link href="/sessions">Schedule one</Link></Button> : undefined}
        className="border-0 p-6"
      />
    );
  }
  return (
    <ul className="space-y-2">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border bg-background/40 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{s.title}</p>
            <p className="text-[11px] text-muted-foreground">
              {s.status === "active"
                ? `Started ${s.started_at ? format(new Date(s.started_at), "p") : ""}`
                : s.scheduled_for
                  ? format(new Date(s.scheduled_for), "EEE, MMM d · p")
                  : "Unscheduled"}
            </p>
          </div>
          <Badge variant={s.status === "active" ? "success" : "secondary"} className="uppercase">{s.status}</Badge>
        </li>
      ))}
      <li className="text-right"><Link href="/sessions" className="text-xs text-primary hover:underline">All sessions →</Link></li>
    </ul>
  );
}
