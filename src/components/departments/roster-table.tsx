"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { RoleBadge } from "@/components/shared/role-badge";
import { addDepartmentMember, removeDepartmentMember, updateDepartmentMember } from "@/server/actions/departments";
import type { DepartmentRank, MemberStatus, Profile, RosterRow } from "@/lib/types/database";

type MemberLite = Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role">;

const STATUS_VARIANT: Record<MemberStatus, "success" | "warning" | "secondary" | "destructive"> = {
  active: "success",
  loa: "warning",
  inactive: "secondary",
  suspended: "destructive",
};
const STATUS_LABEL: Record<MemberStatus, string> = { active: "Active", loa: "LOA", inactive: "Inactive", suspended: "Suspended" };

export function RosterTable({
  departmentId,
  roster,
  ranks,
  members,
  canManage,
  meId,
}: {
  departmentId: string;
  roster: RosterRow[];
  ranks: DepartmentRank[];
  members: MemberLite[];
  canManage: boolean;
  meId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [callsignEdit, setCallsignEdit] = useState<{ id: string; value: string } | null>(null);

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { toast.error(r.error ?? "Failed"); return; }
      toast.success(msg);
      router.refresh();
    });

  const rows = roster.filter((r) => !filter || r.profile.roblox_username.toLowerCase().includes(filter.toLowerCase()) || (r.callsign ?? "").toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <Input placeholder="Filter by name or callsign…" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 max-w-xs" />
        {canManage && <Button size="sm" onClick={() => setAddOpen(true)}><UserPlus className="size-3.5" /> Add member</Button>}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title={roster.length === 0 ? "Roster is empty" : "No matches"} description={roster.length === 0 ? "Leaders can add members from the directory." : undefined} className="m-3" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead>Callsign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              {canManage && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <UserAvatar username={r.profile.roblox_username} avatarUrl={r.profile.avatar_url} className="size-8" />
                    <div className="min-w-0">
                      <Link href={`/members/${r.profile.id}`} className="block truncate text-sm font-medium hover:underline">{r.profile.roblox_display_name ?? r.profile.roblox_username}</Link>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">@{r.profile.roblox_username} {r.profile.role !== "member" && <RoleBadge role={r.profile.role} />}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{r.rank?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {callsignEdit?.id === r.id ? (
                    <Input
                      autoFocus
                      className="h-7 w-24 font-mono text-xs"
                      value={callsignEdit.value}
                      onChange={(e) => setCallsignEdit({ id: r.id, value: e.target.value })}
                      onBlur={() => { act(() => updateDepartmentMember(r.id, { callsign: callsignEdit.value || null }), "Callsign saved"); setCallsignEdit(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setCallsignEdit(null); }}
                    />
                  ) : (
                    <button
                      disabled={!canManage && r.profile.id !== meId}
                      onClick={() => setCallsignEdit({ id: r.id, value: r.callsign ?? "" })}
                      className="rounded px-1.5 py-0.5 font-mono text-xs hover:bg-accent disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      {r.callsign ?? <span className="font-sans text-muted-foreground">—</span>}
                    </button>
                  )}
                </TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{new Date(r.joined_at).toLocaleDateString()}</TableCell>
                {canManage && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" disabled={pending}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Set rank</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {ranks.map((rk) => (
                              <DropdownMenuItem key={rk.id} onSelect={() => act(() => updateDepartmentMember(r.id, { rankId: rk.id }), `Rank set to ${rk.name}`)}>{rk.name}</DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => act(() => updateDepartmentMember(r.id, { rankId: null }), "Rank cleared")}>No rank</DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>Set status</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {(Object.keys(STATUS_LABEL) as MemberStatus[]).map((s) => (
                              <DropdownMenuItem key={s} onSelect={() => act(() => updateDepartmentMember(r.id, { status: s }), `Status: ${STATUS_LABEL[s]}`)}>{STATUS_LABEL[s]}</DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px]">Danger zone</DropdownMenuLabel>
                        <DropdownMenuItem className="text-destructive" onSelect={() => { if (confirm(`Remove ${r.profile.roblox_username} from the roster?`)) act(() => removeDepartmentMember(r.id), "Removed from roster"); }}>
                          Remove from department
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} departmentId={departmentId} ranks={ranks} members={members.filter((m) => !roster.some((r) => r.profile.id === m.id))} />
    </div>
  );
}

function AddMemberDialog({ open, onOpenChange, departmentId, ranks, members }: { open: boolean; onOpenChange: (o: boolean) => void; departmentId: string; ranks: DepartmentRank[]; members: MemberLite[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [profileId, setProfileId] = useState("");
  const [rankId, setRankId] = useState("none");
  const [callsign, setCallsign] = useState("");
  const [q, setQ] = useState("");
  const list = members.filter((m) => !q || m.roblox_username.toLowerCase().includes(q.toLowerCase())).slice(0, 50);

  const submit = () =>
    start(async () => {
      const r = await addDepartmentMember(departmentId, profileId, rankId === "none" ? null : rankId, callsign || null);
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Added to roster");
      onOpenChange(false);
      setProfileId(""); setCallsign(""); setRankId("none");
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add to roster</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Member</Label>
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-1" />
            <div className="max-h-40 overflow-y-auto rounded-md border p-1">
              {list.map((m) => (
                <button key={m.id} onClick={() => setProfileId(m.id)} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${profileId === m.id ? "bg-primary/15 text-primary" : "hover:bg-accent"}`}>
                  <UserAvatar username={m.roblox_username} avatarUrl={m.avatar_url} className="size-5" /> {m.roblox_username}
                </button>
              ))}
              {list.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">Everyone is already on the roster.</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Rank</Label>
              <Select value={rankId} onValueChange={setRankId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No rank</SelectItem>
                  {ranks.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5"><Label>Callsign</Label><Input value={callsign} onChange={(e) => setCallsign(e.target.value)} placeholder="e.g. 1A-12" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending || !profileId}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
