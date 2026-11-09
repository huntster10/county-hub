"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { Gavel, Plus, Search, Trash2, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { PUNISHMENT_VARIANT } from "@/components/dashboard/widgets/recent-punishments";
import { createPunishment, deletePunishment, setPunishmentActive } from "@/server/actions/punishments";
import type { Punishment, PunishmentType } from "@/lib/types/database";

export type PunishmentRow = Punishment & { moderator: { id: string; roblox_username: string; avatar_url: string | null } | null };

const TYPES: { value: PunishmentType; label: string; hint: string }[] = [
  { value: "warning", label: "Warning", hint: "A formal warning on record." },
  { value: "kick", label: "Kick", hint: "Removed from the server once." },
  { value: "ban", label: "Ban", hint: "Blocked from the server (optionally temporary)." },
  { value: "note", label: "Note", hint: "Staff-only note, not a punishment." },
  { value: "bolo", label: "BOLO", hint: "Be on the lookout — flag for other staff." },
];

export function PunishmentsPanel({ rows, openNew, prefillUser, canDelete }: { rows: PunishmentRow[]; openNew: boolean; prefillUser?: string; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState(prefillUser ?? "");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [dialog, setDialog] = useState(openNew);

  const filtered = useMemo(
    () =>
      rows.filter(
        (p) =>
          (!q || p.target_username.toLowerCase().includes(q.toLowerCase()) || p.reason.toLowerCase().includes(q.toLowerCase()) || (p.moderator?.roblox_username ?? "").toLowerCase().includes(q.toLowerCase())) &&
          (typeFilter === "all" || p.type === typeFilter) &&
          (!activeOnly || p.active),
      ),
    [rows, q, typeFilter, activeOnly],
  );

  // Summary for the searched player.
  const playerSummary = useMemo(() => {
    if (!q) return null;
    const theirs = rows.filter((p) => p.target_username.toLowerCase() === q.toLowerCase());
    if (!theirs.length) return null;
    const counts = theirs.reduce<Record<string, number>>((a, p) => ((a[p.type] = (a[p.type] ?? 0) + 1), a), {});
    return { username: theirs[0].target_username, robloxId: theirs[0].target_roblox_id, counts, total: theirs.length, activeBan: theirs.some((p) => p.type === "ban" && p.active) };
  }, [rows, q]);

  const toggle = (p: PunishmentRow) =>
    start(async () => {
      const r = await setPunishmentActive(p.id, !p.active);
      if (r.ok) { toast.success(p.active ? "Marked as inactive" : "Marked as active"); router.refresh(); } else toast.error(r.error);
    });
  const remove = (p: PunishmentRow) =>
    start(async () => {
      if (!confirm("Permanently delete this log entry?")) return;
      const r = await deletePunishment(p.id);
      if (r.ok) { toast.success("Deleted"); router.refresh(); } else toast.error(r.error);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search player, reason or moderator…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={activeOnly} onCheckedChange={setActiveOnly} /> Active only</label>
        <Button onClick={() => setDialog(true)} className="ml-auto"><Plus className="size-4" /> Log punishment</Button>
      </div>

      {playerSummary && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4">
          <div>
            <p className="text-sm font-semibold">{playerSummary.username}</p>
            <p className="text-xs text-muted-foreground">{playerSummary.robloxId ? `Roblox ID ${playerSummary.robloxId}` : "Roblox ID unknown"} · {playerSummary.total} record{playerSummary.total === 1 ? "" : "s"}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(playerSummary.counts).map(([t, n]) => <Badge key={t} variant={PUNISHMENT_VARIANT[t as PunishmentType]} className="uppercase">{t} × {n}</Badge>)}
          </div>
          {playerSummary.activeBan && <Badge variant="destructive" className="ml-auto">Currently banned</Badge>}
          {playerSummary.robloxId && (
            <a href={`https://www.roblox.com/users/${playerSummary.robloxId}/profile`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">Roblox profile <ExternalLink className="size-3" /></a>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card">
        {filtered.length === 0 ? (
          <EmptyState icon={Gavel} title={rows.length ? "No matches" : "No punishments logged yet"} description={rows.length ? "Try a different search." : "Click “Log punishment” to add the first one."} className="m-3" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Moderator</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className={!p.active ? "opacity-60" : ""}>
                  <TableCell><Badge variant={PUNISHMENT_VARIANT[p.type]} className="uppercase">{p.type}</Badge></TableCell>
                  <TableCell>
                    <button onClick={() => setQ(p.target_username)} className="text-sm font-medium hover:underline">{p.target_username}</button>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="truncate text-sm" title={p.reason}>{p.reason}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.duration_minutes ? `${p.duration_minutes} min` : p.type === "ban" ? "Permanent" : ""}
                      {p.evidence_url && <> · <a href={p.evidence_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">evidence</a></>}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs"><UserAvatar username={p.moderator?.roblox_username} avatarUrl={p.moderator?.avatar_url} className="size-5" /> {p.moderator?.roblox_username ?? "unknown"}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground" title={new Date(p.created_at).toLocaleString()}>{formatDistanceToNowStrict(new Date(p.created_at), { addSuffix: true })}</TableCell>
                  <TableCell>
                    <button onClick={() => toggle(p)} disabled={pending} className="flex items-center gap-1 text-xs">
                      {p.active ? <><CheckCircle2 className="size-3.5 text-success" /> Active</> : <><XCircle className="size-3.5 text-muted-foreground" /> Inactive</>}
                    </button>
                  </TableCell>
                  <TableCell>
                    {canDelete && <Button variant="ghost" size="icon-sm" className="text-destructive" disabled={pending} onClick={() => remove(p)}><Trash2 className="size-3.5" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <NewPunishmentDialog open={dialog} onOpenChange={(o) => { setDialog(o); if (!o && openNew) router.replace("/staff/punishments"); }} prefillUser={prefillUser} />
    </div>
  );
}

function NewPunishmentDialog({ open, onOpenChange, prefillUser }: { open: boolean; onOpenChange: (o: boolean) => void; prefillUser?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [type, setType] = useState<PunishmentType>("warning");
  const [username, setUsername] = useState(prefillUser ?? "");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [duration, setDuration] = useState("");
  const [runInGame, setRunInGame] = useState(false);

  const submit = () =>
    start(async () => {
      const r = await createPunishment({
        type,
        targetUsername: username.trim(),
        reason: reason.trim(),
        evidenceUrl: evidence.trim() || null,
        durationMinutes: duration ? Number(duration) : null,
      });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`${type} logged for ${username}`);

      if (runInGame && (type === "kick" || type === "ban")) {
        const cmd = type === "kick" ? `:kick ${username.trim()}` : `:ban ${username.trim()}`;
        const res = await fetch("/api/erlc/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: cmd }) });
        const body = await res.json().catch(() => ({}));
        res.ok ? toast.success(`In-game: ${body.message ?? "command sent"}`) : toast.error(`In-game command failed: ${body.error ?? res.status}`);
      }

      onOpenChange(false);
      setUsername(""); setReason(""); setEvidence(""); setDuration("");
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a punishment</DialogTitle>
          <DialogDescription>This is recorded under your name and mirrored to #mod-logs.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-5 gap-1.5">
            {TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setType(t.value)} className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors ${type === t.value ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"}`}>{t.label}</button>
            ))}
          </div>
          <p className="-mt-2 text-[11px] text-muted-foreground">{TYPES.find((t) => t.value === type)?.hint}</p>
          <div className="grid gap-1.5"><Label>Roblox username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Exact username" /></div>
          <div className="grid gap-1.5"><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What happened? Be specific — other staff will read this." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5"><Label>Evidence link (optional)</Label><Input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="https://…" /></div>
            {type === "ban" && <div className="grid gap-1.5"><Label>Duration in minutes (blank = permanent)</Label><Input type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} /></div>}
          </div>
          {(type === "kick" || type === "ban") && (
            <label className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>
                Also run <code className="rounded bg-muted px-1 font-mono text-xs">:{type} {username || "player"}</code> in-game
                <span className="block text-[11px] text-muted-foreground">Requires the ER:LC API key to be configured.</span>
              </span>
              <Switch checked={runInGame} onCheckedChange={setRunInGame} />
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending || username.trim().length < 3 || reason.trim().length < 3}>Save log</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
