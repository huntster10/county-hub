"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Activity, LogIn, LogOut, Skull, Terminal, Megaphone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useErlcStatus } from "@/lib/hooks/use-erlc-status";
import { parseErlcPlayer } from "@/lib/utils";

interface FeedItem {
  key: string;
  ts: number;
  icon: typeof LogIn;
  tone: string;
  text: React.ReactNode;
}

/** Merged feed of joins, leaves, kills, commands and mod calls from the live API. */
export function LiveEventsWidget({ limit = 12 }: { limit?: number }) {
  const { data, loading } = useErlcStatus();

  if (loading) return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>;
  if (!data?.configured || !data.logs) {
    return <EmptyState icon={Activity} title="No live events" description="Connect the ER:LC API to see joins, kills and commands here." className="border-0 p-6" />;
  }

  const name = (p: string) => parseErlcPlayer(p).username;
  const items: FeedItem[] = [
    ...data.logs.joins.map((j) => ({
      key: `j${j.Timestamp}${j.Player}`,
      ts: j.Timestamp,
      icon: j.Join ? LogIn : LogOut,
      tone: j.Join ? "text-success" : "text-muted-foreground",
      text: <><b>{name(j.Player)}</b> {j.Join ? "joined" : "left"} the server</>,
    })),
    ...data.logs.kills.map((k) => ({
      key: `k${k.Timestamp}${k.Killed}`,
      ts: k.Timestamp,
      icon: Skull,
      tone: "text-destructive",
      text: <><b>{name(k.Killer)}</b> killed <b>{name(k.Killed)}</b></>,
    })),
    ...data.logs.commands.map((c) => ({
      key: `c${c.Timestamp}${c.Command}`,
      ts: c.Timestamp,
      icon: Terminal,
      tone: "text-chart-4",
      text: <><b>{name(c.Player)}</b> ran <code className="rounded bg-muted px-1 font-mono text-[11px]">{c.Command}</code></>,
    })),
    ...data.logs.modCalls.map((m) => ({
      key: `m${m.Timestamp}${m.Caller}`,
      ts: m.Timestamp,
      icon: Megaphone,
      tone: "text-chart-2",
      text: <><b>{name(m.Caller)}</b> called a mod{m.Moderator ? <> — answered by <b>{name(m.Moderator)}</b></> : " (unanswered)"}</>,
    })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);

  if (items.length === 0) return <EmptyState icon={Activity} title="Quiet so far" description="Events will appear as players join." className="border-0 p-6" />;

  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.key} className="flex items-start gap-2 text-xs">
          <it.icon className={`mt-0.5 size-3.5 shrink-0 ${it.tone}`} />
          <span className="flex-1 leading-snug text-muted-foreground [&_b]:font-medium [&_b]:text-foreground">{it.text}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{formatDistanceToNowStrict(new Date(it.ts * 1000))}</span>
        </li>
      ))}
    </ul>
  );
}
