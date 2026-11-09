"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { MapPin, Plus, Siren, UserPlus, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { createCall, toggleSelfAssign, updateCall } from "@/server/actions/community";
import type { CadCall, CadStatus, Department, Profile } from "@/lib/types/database";

export type CallRow = CadCall & { department: { name: string; color: string } | null; creator: { roblox_username: string } | null };

const COLUMNS: { status: CadStatus; label: string; tone: string }[] = [
  { status: "pending", label: "Pending", tone: "text-warning" },
  { status: "dispatched", label: "Dispatched", tone: "text-primary" },
  { status: "on_scene", label: "On scene", tone: "text-chart-3" },
  { status: "resolved", label: "Resolved", tone: "text-muted-foreground" },
];
const PRIORITY: Record<number, { label: string; variant: "destructive" | "warning" | "secondary" }> = {
  1: { label: "P1 · High", variant: "destructive" },
  2: { label: "P2 · Medium", variant: "warning" },
  3: { label: "P3 · Low", variant: "secondary" },
};

export function CadBoard({ calls, departments, profiles, me, canManage, openNew }: { calls: CallRow[]; departments: Pick<Department, "id" | "name" | "color">[]; profiles: Pick<Profile, "id" | "roblox_username" | "avatar_url">[]; me: Profile; canManage: boolean; openNew: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState(openNew);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [priority, setPriority] = useState("2");
  const [departmentId, setDepartmentId] = useState("none");

  // Live updates: refresh the board whenever any call changes.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel("cad").on("postgres_changes", { event: "*", schema: "public", table: "cad_calls" }, () => router.refresh()).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [router]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { toast.error(r.error ?? "Failed"); return; }
      if (msg) toast.success(msg);
      router.refresh();
    });

  const who = (id: string) => profiles.find((p) => p.id === id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{calls.filter((c) => c.status !== "resolved" && c.status !== "cancelled").length} open calls</p>
        <Button size="sm" onClick={() => setDialog(true)}><Plus className="size-3.5" /> New call</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = calls.filter((c) => c.status === col.status);
          return (
            <div key={col.status} className="rounded-xl border bg-card/60">
              <div className="flex items-center justify-between border-b px-3 py-2">
                <p className={`text-xs font-semibold uppercase tracking-wider ${col.tone}`}>{col.label}</p>
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium">{items.length}</span>
              </div>
              <div className="space-y-2 p-2">
                {items.length === 0 && <p className="py-6 text-center text-[11px] text-muted-foreground">Empty</p>}
                {items.map((c) => {
                  const assigned = c.assigned_to.includes(me.id);
                  return (
                    <div key={c.id} className={`space-y-2 rounded-lg border bg-card p-3 ${c.priority === 1 && c.status !== "resolved" ? "border-destructive/50" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{c.title}</p>
                        <Badge variant={PRIORITY[c.priority]?.variant ?? "secondary"} className="shrink-0">{PRIORITY[c.priority]?.label ?? `P${c.priority}`}</Badge>
                      </div>
                      {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {c.location && <span className="flex items-center gap-1"><MapPin className="size-3" /> {c.location}</span>}
                        {c.department && <span className="flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ background: c.department.color }} />{c.department.name}</span>}
                        <span>{formatDistanceToNowStrict(new Date(c.created_at), { addSuffix: true })}{c.creator && ` by ${c.creator.roblox_username}`}</span>
                      </div>
                      {c.assigned_to.length > 0 && (
                        <div className="flex -space-x-1.5">
                          {c.assigned_to.map((id) => { const p = who(id); return <UserAvatar key={id} username={p?.roblox_username} avatarUrl={p?.avatar_url} className="size-6 ring-2 ring-card" />; })}
                        </div>
                      )}
                      {c.status !== "resolved" && c.status !== "cancelled" && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <Button size="sm" variant={assigned ? "secondary" : "outline"} className="h-7 text-xs" disabled={pending} onClick={() => run(() => toggleSelfAssign(c.id))}>
                            {assigned ? <><UserMinus className="size-3" /> Detach</> : <><UserPlus className="size-3" /> Respond</>}
                          </Button>
                          {(assigned || canManage) && (
                            <Select value={c.status} onValueChange={(v) => run(() => updateCall(c.id, { status: v as CadStatus }), "Status updated")}>
                              <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {COLUMNS.map((s) => <SelectItem key={s.status} value={s.status}>{s.label}</SelectItem>)}
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {calls.length === 0 && <EmptyState icon={Siren} title="No calls on the board" description="Create a call when something happens in the city." />}

      <Dialog open={dialog} onOpenChange={(o) => { setDialog(o); if (!o && openNew) router.replace("/cad"); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>New call</DialogTitle><DialogDescription>Give responders enough detail to find the scene.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5"><Label>What&apos;s happening?</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Bank robbery in progress" /></div>
            <div className="grid gap-1.5"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Liberty City Bank, postal 123" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="1">P1 — High</SelectItem><SelectItem value="2">P2 — Medium</SelectItem><SelectItem value="3">P3 — Low</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Department</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Any</SelectItem>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5"><Label>Details</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[70px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(false)}>Cancel</Button>
            <Button disabled={pending || title.trim().length < 2} onClick={() => { run(() => createCall({ title, description, location, priority: Number(priority), departmentId: departmentId === "none" ? null : departmentId }), "Call created"); setDialog(false); setTitle(""); setDescription(""); setLocation(""); }}>Create call</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
