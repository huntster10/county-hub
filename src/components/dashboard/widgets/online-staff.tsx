"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDuration } from "@/lib/utils";
import type { OnlineStaffRow } from "@/lib/data/dashboard";

export function OnlineStaffWidget({ rows }: { rows: OnlineStaffRow[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (rows.length === 0) {
    return <EmptyState icon={Clock} title="Nobody is on duty" description="Staff who clock in appear here with a live timer." className="border-0 p-6" />;
  }

  return (
    <ul className="divide-y divide-border/60">
      {rows.map((shift) => {
        const { profile, department } = shift;
        const elapsed = now - new Date(shift.started_at).getTime() - shift.total_break_seconds * 1000;
        const onBreak = shift.status === "on_break";
        return (
          <li key={shift.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <UserAvatar username={profile.roblox_username} avatarUrl={profile.avatar_url} className="size-8" />
            <div className="min-w-0 flex-1">
              <Link href={`/members/${profile.id}`} className="block truncate text-sm font-medium hover:underline">
                {profile.roblox_display_name ?? profile.roblox_username}
              </Link>
              <p className="truncate text-[11px] text-muted-foreground">
                {department ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full" style={{ background: department.color }} />
                    {department.name}
                  </span>
                ) : (
                  "General staff"
                )}
              </p>
            </div>
            <span className={`rounded-md px-1.5 py-0.5 font-mono text-[11px] ${onBreak ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
              {onBreak ? "break · " : ""}{formatDuration(elapsed)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
