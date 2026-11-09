"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import { CalendarClock, Play, Square, Trash2, Plus, BarChart3, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { createPoll, createSession, deletePoll, deleteSession, setSessionStatus, vote } from "@/server/actions/community";
import type { Poll, Session } from "@/lib/types/database";

export type SessionRow = Session & { host: { roblox_username: string; avatar_url: string | null } | null };
export type PollRow = Poll;

export function SessionsBoard({ sessions, polls, votes, canManage, meId }: { sessions: SessionRow[]; polls: PollRow[]; votes: { poll_id: string; profile_id: string; option_index: number }[]; canManage: boolean; meId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newOpen, setNewOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("Yes, No");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { toast.error(r.error ?? "Failed"); return; }
      toast.success(msg);
      router.refresh();
    });

  const active = sessions.filter((s) => s.status === "active");
  const upcoming = sessions.filter((s) => s.status === "scheduled");
  const past = sessions.filter((s) => s.status === "ended");

  const SessionCard = ({ s }: { s: SessionRow }) => (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background/40 p-3">
      <div className={`size-2 rounded-full ${s.status === "active" ? "animate-pulse bg-success" : s.status === "scheduled" ? "bg-warning" : "bg-muted-foreground"}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{s.title}</p>
        <p className="text-[11px] text-muted-foreground">
          {s.status === "active" && s.started_at && `Started ${formatDistanceToNowStrict(new Date(s.started_at))} ago`}
          {s.status === "scheduled" && (s.scheduled_for ? format(new Date(s.scheduled_for), "EEE, MMM d · p") : "No time set")}
          {s.status === "ended" && s.ended_at && `${format(new Date(s.ended_at), "MMM d")} · peak ${s.peak_players} players`}
          {s.host && <> · hosted by {s.host.roblox_username}</>}
        </p>
        {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}
      </div>
      {canManage && (
        <div className="flex items-center gap-1">
          {s.status === "scheduled" && <Button size="sm" variant="success" disabled={pending} onClick={() => run(() => setSessionStatus(s.id, "active"), "Session started")}><Play className="size-3.5" /> Start</Button>}
          {s.status === "active" && <Button size="sm" variant="destructive" disabled={pending} onClick={() => { const peak = prompt("Peak player count (optional)"); run(() => setSessionStatus(s.id, "ended", peak ? Number(peak) : undefined), "Session ended"); }}><Square className="size-3.5" /> End</Button>}
          <Button size="icon-sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => confirm("Delete this session?") && run(() => deleteSession(s.id), "Deleted")}><Trash2 className="size-3.5" /></Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="size-3.5" /> Schedule session</Button>
            <Button size="sm" variant="outline" onClick={() => setPollOpen(true)}><BarChart3 className="size-3.5" /> New poll</Button>
          </div>
        )}
        {active.length > 0 && (
          <Card className="border-success/40">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-success"><span className="size-2 animate-pulse rounded-full bg-success" /> Live now</CardTitle></CardHeader>
            <CardContent className="space-y-2">{active.map((s) => <SessionCard key={s.id} s={s} />)}</CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-3"><CardTitle>Upcoming</CardTitle><CardDescription>Sessions that haven&apos;t started yet.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? <EmptyState icon={CalendarClock} title="Nothing scheduled" className="border-0 p-6" /> : upcoming.map((s) => <SessionCard key={s.id} s={s} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle>History</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {past.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No past sessions yet.</p> : past.slice(0, 15).map((s) => <SessionCard key={s.id} s={s} />)}
          </CardContent>
        </Card>
      </div>

      {/* Polls */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle>Polls</CardTitle><CardDescription>Vote once; you can change your vote until the poll closes.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {polls.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No polls yet.</p>}
            {polls.map((p) => {
              const pv = votes.filter((v) => v.poll_id === p.id);
              const mine = pv.find((v) => v.profile_id === meId)?.option_index;
              const closed = p.closes_at ? new Date(p.closes_at) < new Date() : false;
              return (
                <div key={p.id} className="space-y-2 rounded-lg border bg-background/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{p.question}</p>
                    {closed ? <Badge variant="secondary">Closed</Badge> : <Badge variant="success">Open</Badge>}
                  </div>
                  {p.options.map((o, i) => {
                    const n = pv.filter((v) => v.option_index === i).length;
                    const pct = pv.length ? Math.round((n / pv.length) * 100) : 0;
                    return (
                      <button key={i} disabled={closed || pending} onClick={() => run(() => vote(p.id, i), "Vote recorded")} className="relative block w-full overflow-hidden rounded-md border text-left text-xs transition-colors hover:border-primary/50 disabled:cursor-default">
                        <span className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${pct}%` }} />
                        <span className="relative flex items-center justify-between px-2.5 py-1.5"><span className="flex items-center gap-1.5">{mine === i && <Check className="size-3 text-primary" />}{o}</span><span className="text-muted-foreground">{n} · {pct}%</span></span>
                      </button>
                    );
                  })}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{pv.length} vote{pv.length === 1 ? "" : "s"}{p.closes_at && !closed && ` · closes ${formatDistanceToNowStrict(new Date(p.closes_at), { addSuffix: true })}`}</span>
                    {canManage && <button className="text-destructive hover:underline" onClick={() => confirm("Delete poll?") && run(() => deletePoll(p.id), "Poll deleted")}>delete</button>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule a session</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Friday Night Patrol" /></div>
            <div className="grid gap-1.5"><Label>When (your local time)</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
            <div className="grid gap-1.5"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Theme, rules, what to expect…" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button disabled={pending || title.trim().length < 2} onClick={() => { run(() => createSession({ title, scheduledFor: when ? new Date(when).toISOString() : null, notes }), "Session scheduled"); setNewOpen(false); setTitle(""); setWhen(""); setNotes(""); }}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pollOpen} onOpenChange={setPollOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New poll</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5"><Label>Question</Label><Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Should we start a session now?" /></div>
            <div className="grid gap-1.5"><Label>Options (comma separated)</Label><Input value={options} onChange={(e) => setOptions(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPollOpen(false)}>Cancel</Button>
            <Button disabled={pending} onClick={() => { run(() => createPoll(question, options.split(","), null, null), "Poll created"); setPollOpen(false); setQuestion(""); }}>Create poll</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
