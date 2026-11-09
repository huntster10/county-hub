"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Radar, RefreshCw, Search, Terminal, Star, Car, Users, Gavel, MessageSquare, UserX, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useErlcStatus } from "@/lib/hooks/use-erlc-status";
import { parseErlcPlayer } from "@/lib/utils";
import { teamColorClient } from "@/components/dashboard/widgets/team-colors";

const COMMAND_EXAMPLES = [":h Welcome to the server!", ":m Please follow the rules", ":pm Player Hello", ":kick Player", ":ban Player", ":weather clear", ":time 14", ":tp Player1 Player2"];

export function LivePlayers({ focusCommand }: { focusCommand: boolean }) {
  const { data, loading, refresh } = useErlcStatus();
  const [q, setQ] = useState("");
  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<{ cmd: string; ok: boolean; msg: string; at: number }[]>([]);
  const cmdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusCommand) cmdRef.current?.focus();
  }, [focusCommand]);

  const run = async (cmd: string) => {
    if (!cmd.trim()) return;
    setSending(true);
    const res = await fetch("/api/erlc/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: cmd }) });
    const body = await res.json().catch(() => ({}));
    setSending(false);
    const ok = res.ok;
    setHistory((h) => [{ cmd, ok, msg: ok ? body.message ?? "Success" : body.error ?? `Error ${res.status}`, at: Date.now() }, ...h].slice(0, 20));
    ok ? toast.success(`Sent: ${cmd}`) : toast.error(body.error ?? "Command failed");
    if (ok) { setCommand(""); setTimeout(() => refresh(), 1500); }
  };

  if (loading) return <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-96 lg:col-span-2" /><Skeleton className="h-96" /></div>;

  if (!data?.configured || data.error || !data.server) {
    return (
      <EmptyState
        icon={Radar}
        title={data?.configured ? "Couldn't reach the ER:LC API" : "ER:LC API not connected"}
        description={data?.error ?? "Add your private server's API key under Settings to see live players."}
        action={data?.configured ? <Button variant="outline" size="sm" onClick={() => refresh()}><RefreshCw className="size-3.5" /> Retry</Button> : <Button asChild size="sm"><Link href="/settings">Open settings</Link></Button>}
      />
    );
  }

  const players = (data.players ?? []).map((p) => ({ ...p, ...parseErlcPlayer(p.Player) }));
  const filtered = players.filter((p) => !q || p.username.toLowerCase().includes(q.toLowerCase()) || p.Team.toLowerCase().includes(q.toLowerCase()) || (p.Callsign ?? "").toLowerCase().includes(q.toLowerCase()));
  const staffIds = new Set([...Object.keys(data.staff?.Admins ?? {}), ...Object.keys(data.staff?.Mods ?? {}), ...Object.keys(data.staff?.Helpers ?? {})]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input placeholder="Filter by name, team or callsign…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          <Badge variant="secondary"><Users className="size-3" /> {data.server.CurrentPlayers}/{data.server.MaxPlayers}</Badge>
          {(data.queue?.length ?? 0) > 0 && <Badge variant="warning">{data.queue!.length} in queue</Badge>}
          <Button variant="ghost" size="icon-sm" onClick={() => refresh()}><RefreshCw className="size-3.5" /></Button>
        </div>

        <Tabs defaultValue="players">
          <TabsList>
            <TabsTrigger value="players">Players ({players.length})</TabsTrigger>
            <TabsTrigger value="vehicles">Vehicles ({data.vehicles?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="staff">Server staff</TabsTrigger>
          </TabsList>

          <TabsContent value="players">
            <div className="rounded-xl border bg-card">
              {filtered.length === 0 ? (
                <EmptyState icon={Radar} title={players.length ? "No matches" : "Server is empty"} className="m-3" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Callsign</TableHead>
                      <TableHead>Permission</TableHead>
                      <TableHead>Wanted</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.Player}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{p.username}</span>
                            {p.robloxId && staffIds.has(p.robloxId) && <Badge variant="default">staff</Badge>}
                          </div>
                          {p.robloxId && <a href={`https://www.roblox.com/users/${p.robloxId}/profile`} target="_blank" rel="noreferrer" className="text-[11px] text-muted-foreground hover:text-primary">ID {p.robloxId}</a>}
                        </TableCell>
                        <TableCell><span className="flex items-center gap-1.5 text-sm"><span className="size-2 rounded-full" style={{ background: teamColorClient(p.Team) }} />{p.Team}</span></TableCell>
                        <TableCell className="font-mono text-xs">{p.Callsign ?? <span className="font-sans text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.Permission}</TableCell>
                        <TableCell>{p.WantedStars ? <span className="flex items-center gap-0.5 text-xs text-warning"><Star className="size-3 fill-current" /> {p.WantedStars}</span> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm"><Terminal className="size-3.5" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onSelect={() => { setCommand(`:pm ${p.username} `); cmdRef.current?.focus(); }}><MessageSquare /> Private message</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => run(`:kick ${p.username}`)}><UserX /> Kick</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => confirm(`Ban ${p.username} from the server?`) && run(`:ban ${p.username}`)} className="text-destructive"><Ban /> Ban</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild><Link href={`/staff/punishments?new=1&user=${encodeURIComponent(p.username)}`}><Gavel /> Log punishment</Link></DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="vehicles">
            <div className="rounded-xl border bg-card">
              {!data.vehicles?.length ? (
                <EmptyState icon={Car} title="No vehicles spawned" className="m-3" />
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Vehicle</TableHead><TableHead>Owner</TableHead><TableHead>Plate</TableHead><TableHead>Colour</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.vehicles.map((v, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium">{v.Name}{v.Texture ? <span className="ml-1 text-xs text-muted-foreground">({v.Texture})</span> : null}</TableCell>
                        <TableCell className="text-sm">{parseErlcPlayer(v.Owner).username}</TableCell>
                        <TableCell className="font-mono text-xs">{v.Plate ?? "—"}</TableCell>
                        <TableCell><span className="flex items-center gap-1.5 text-xs">{v.ColorHex && <span className="size-3 rounded-sm border" style={{ background: v.ColorHex }} />}{v.ColorName ?? v.ColorHex ?? "—"}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="staff">
            <div className="grid gap-3 sm:grid-cols-3">
              {(["Admins", "Mods", "Helpers"] as const).map((group) => {
                const entries = Object.entries(data.staff?.[group] ?? {});
                return (
                  <Card key={group}>
                    <CardHeader className="pb-2"><CardTitle>{group} ({entries.length})</CardTitle></CardHeader>
                    <CardContent>
                      {entries.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : (
                        <ul className="space-y-1 text-sm">{entries.map(([id, name]) => <li key={id} className="flex justify-between"><span>{name}</span><span className="text-[11px] text-muted-foreground">{id}</span></li>)}</ul>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">These are in-game server permissions set in ER:LC, separate from roles on this website.</p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Command console */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Terminal className="size-4" /> Command console</CardTitle>
          <CardDescription>Runs as “virtual server management”. Everything is recorded in the audit log.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); void run(command); }} className="flex gap-2">
            <Input ref={cmdRef} value={command} onChange={(e) => setCommand(e.target.value)} placeholder=":h Hello everyone" className="font-mono" />
            <Button type="submit" disabled={sending || !command.trim()}>{sending ? <Loader2 className="size-4 animate-spin" /> : "Run"}</Button>
          </form>
          <div className="flex flex-wrap gap-1">
            {COMMAND_EXAMPLES.map((c) => (
              <button key={c} onClick={() => { setCommand(c); cmdRef.current?.focus(); }} className="rounded border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground">{c}</button>
            ))}
          </div>
          {history.length > 0 && (
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border bg-background/40 p-2 font-mono text-[11px]">
              {history.map((h) => (
                <li key={h.at} className="flex flex-col">
                  <span className={h.ok ? "text-success" : "text-destructive"}>{h.ok ? "✓" : "✗"} {h.cmd}</span>
                  <span className="text-muted-foreground">{h.msg}</span>
                </li>
              ))}
            </ul>
          )}
          {data.rate && data.rate.remaining !== null && <p className="text-[10px] text-muted-foreground">API budget: {data.rate.remaining}/{data.rate.limit} requests left in this window.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
