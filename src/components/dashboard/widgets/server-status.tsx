"use client";

import { useState } from "react";
import { Copy, Check, RefreshCw, Users, Wifi, WifiOff, Settings } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useErlcStatus } from "@/lib/hooks/use-erlc-status";
import { teamColorClient } from "./team-colors";

/** Live ER:LC server card: player count, join code, queue, team split. */
export function ServerStatusWidget({ canConfigure }: { canConfigure: boolean }) {
  const { data, loading, refresh } = useErlcStatus();
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-4 text-center">
        <WifiOff className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No ER:LC API key yet.</p>
        {canConfigure ? (
          <Button asChild size="sm" variant="outline">
            <Link href="/settings"><Settings className="size-3.5" /> Add API key</Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Ask an admin to add it under Settings.</p>
        )}
      </div>
    );
  }

  if (data.error || !data.server) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-4 text-center">
        <WifiOff className="size-6 text-destructive" />
        <p className="text-sm text-destructive">{data.error ?? "Unknown error"}</p>
        <Button size="sm" variant="outline" onClick={() => refresh()}><RefreshCw className="size-3.5" /> Retry</Button>
      </div>
    );
  }

  const { server, players = [], queue = [] } = data;
  const teams = players.reduce<Record<string, number>>((acc, p) => {
    acc[p.Team] = (acc[p.Team] ?? 0) + 1;
    return acc;
  }, {});
  const teamEntries = Object.entries(teams).sort((a, b) => b[1] - a[1]);
  const pct = server.MaxPlayers ? Math.round((server.CurrentPlayers / server.MaxPlayers) * 100) : 0;

  const copyCode = async () => {
    if (!server.JoinKey) return;
    await navigator.clipboard.writeText(server.JoinKey);
    setCopied(true);
    toast.success("Join code copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            <p className="truncate text-sm font-medium">{server.Name}</p>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Updated {data.fetchedAt ? new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={() => refresh()} aria-label="Refresh">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Players" value={`${server.CurrentPlayers}`} sub={`/ ${server.MaxPlayers}`} icon={Users} />
        <Stat label="In queue" value={`${queue.length}`} icon={Wifi} />
        <div className="rounded-lg border bg-background/40 p-3">
          <p className="text-[11px] text-muted-foreground">Join code</p>
          {server.JoinKey ? (
            <button onClick={copyCode} className="mt-1 flex items-center gap-1.5 font-mono text-sm font-semibold hover:text-primary">
              {server.JoinKey}
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5 opacity-60" />}
            </button>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Hidden</p>
          )}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
          <span>Capacity</span>
          <span>{pct}%</span>
        </div>
        <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-muted">
          {teamEntries.map(([team, count]) => (
            <div
              key={team}
              title={`${team}: ${count}`}
              style={{ width: `${(count / Math.max(server.MaxPlayers, 1)) * 100}%`, background: teamColorClient(team) }}
            />
          ))}
        </div>
        {teamEntries.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {teamEntries.map(([team, count]) => (
              <span key={team} className="flex items-center gap-1">
                <span className="size-2 rounded-sm" style={{ background: teamColorClient(team) }} />
                {team} <span className="font-medium text-foreground">{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border bg-background/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <p className="mt-1 text-xl font-semibold leading-none">
        {value} {sub && <span className="text-xs font-normal text-muted-foreground">{sub}</span>}
      </p>
    </div>
  );
}
