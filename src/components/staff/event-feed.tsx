"use client";

import { useMemo, useState } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { Activity, LogIn, LogOut, Skull, Terminal, Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useErlcStatus } from "@/lib/hooks/use-erlc-status";
import { parseErlcPlayer } from "@/lib/utils";
import type { GameEvent } from "@/lib/types/database";

type Kind = GameEvent["kind"];
interface Item { key: string; kind: Kind; ts: number; text: string; detail?: string }

const META: Record<Kind, { icon: typeof LogIn; tone: string; label: string }> = {
  join: { icon: LogIn, tone: "text-success", label: "Join" },
  leave: { icon: LogOut, tone: "text-muted-foreground", label: "Leave" },
  kill: { icon: Skull, tone: "text-destructive", label: "Kill" },
  command: { icon: Terminal, tone: "text-chart-4", label: "Command" },
  modcall: { icon: Megaphone, tone: "text-chart-2", label: "Mod call" },
};

/** Live events from the API merged with stored history (de-duplicated). */
export function EventFeed({ history }: { history: GameEvent[] }) {
  const { data } = useErlcStatus();
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const name = (p: string) => parseErlcPlayer(p).username;
    const map = new Map<string, Item>();
    const put = (i: Item) => map.set(i.key, i);

    for (const e of history) {
      const ts = new Date(e.occurred_at).getTime() / 1000;
      const p = e.payload as Record<string, string | null>;
      if (e.kind === "join" || e.kind === "leave") put({ key: `${e.kind}${ts}${p.player}`, kind: e.kind, ts, text: `${name(p.player ?? "")} ${e.kind === "join" ? "joined" : "left"}` });
      if (e.kind === "kill") put({ key: `kill${ts}${p.killed}`, kind: "kill", ts, text: `${name(p.killer ?? "")} killed ${name(p.killed ?? "")}` });
      if (e.kind === "command") put({ key: `command${ts}${p.command}`, kind: "command", ts, text: `${name(p.player ?? "")}`, detail: p.command ?? "" });
      if (e.kind === "modcall") put({ key: `modcall${ts}${p.caller}`, kind: "modcall", ts, text: `${name(p.caller ?? "")} called a moderator`, detail: p.moderator ? `Answered by ${name(p.moderator)}` : "Unanswered" });
    }
    if (data?.logs) {
      for (const j of data.logs.joins) put({ key: `${j.Join ? "join" : "leave"}${j.Timestamp}${j.Player}`, kind: j.Join ? "join" : "leave", ts: j.Timestamp, text: `${name(j.Player)} ${j.Join ? "joined" : "left"}` });
      for (const k of data.logs.kills) put({ key: `kill${k.Timestamp}${k.Killed}`, kind: "kill", ts: k.Timestamp, text: `${name(k.Killer)} killed ${name(k.Killed)}` });
      for (const c of data.logs.commands) put({ key: `command${c.Timestamp}${c.Command}`, kind: "command", ts: c.Timestamp, text: name(c.Player), detail: c.Command });
      for (const m of data.logs.modCalls) put({ key: `modcall${m.Timestamp}${m.Caller}`, kind: "modcall", ts: m.Timestamp, text: `${name(m.Caller)} called a moderator`, detail: m.Moderator ? `Answered by ${name(m.Moderator)}` : "Unanswered" });
    }
    return [...map.values()]
      .filter((i) => filter === "all" || i.kind === filter)
      .filter((i) => !q || i.text.toLowerCase().includes(q.toLowerCase()) || (i.detail ?? "").toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 400);
  }, [history, data, filter, q]);

  // Group by day for readability.
  const groups: { day: string; items: Item[] }[] = [];
  for (const it of items) {
    const day = format(new Date(it.ts * 1000), "EEEE, MMMM d");
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.items.push(it);
    else groups.push({ day, items: [it] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all")}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {(Object.keys(META) as Kind[]).map((k) => <TabsTrigger key={k} value={k}>{META[k].label}s</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <Input placeholder="Filter by player or command…" value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto max-w-xs" />
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Activity} title="No events yet" description={data?.configured ? "Events appear as soon as players join." : "Connect the ER:LC API under Settings to start collecting events."} />
      ) : (
        <Card>
          <CardContent className="p-0">
            {groups.map((g) => (
              <div key={g.day}>
                <p className="sticky top-14 z-10 border-b bg-card/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">{g.day}</p>
                <ul className="divide-y divide-border/60">
                  {g.items.map((it) => {
                    const m = META[it.kind];
                    return (
                      <li key={it.key} className="flex items-center gap-3 px-4 py-2 text-sm">
                        <m.icon className={`size-4 shrink-0 ${m.tone}`} />
                        <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{format(new Date(it.ts * 1000), "p")}</span>
                        <span className="flex-1 truncate">
                          {it.text}
                          {it.detail && <code className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{it.detail}</code>}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{formatDistanceToNowStrict(new Date(it.ts * 1000), { addSuffix: true })}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
