"use client";

import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { MessageSquare } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import type { DashboardData } from "@/lib/data/dashboard";

export function RecentMessagesWidget({ rows }: { rows: DashboardData["recentMessages"] }) {
  if (rows.length === 0) {
    return <EmptyState icon={MessageSquare} title="No messages yet" description="Say hello in #general!" className="border-0 p-6" />;
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((m) => (
        <li key={m.id} className="flex items-start gap-2.5">
          <UserAvatar username={m.author?.roblox_username} avatarUrl={m.author?.avatar_url} className="size-6" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{m.author?.roblox_username ?? "unknown"}</span>
              {m.channel && (
                <> in <Link href={`/messages/${m.channel.id}`} className="text-primary hover:underline">#{m.channel.name}</Link></>
              )}
              {" · "}{formatDistanceToNowStrict(new Date(m.created_at), { addSuffix: true })}
            </p>
            <p className="truncate text-sm">{m.content || <span className="italic text-muted-foreground">attachment</span>}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
