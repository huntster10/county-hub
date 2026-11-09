"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crown, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserAvatar } from "@/components/shared/user-avatar";
import { RoleBadge } from "@/components/shared/role-badge";
import { ASSIGNABLE_ROLES, ROLE_LABEL } from "@/lib/permissions";
import { transferOwnership, updateMemberRole } from "@/server/actions/settings";
import type { AppRole, Profile } from "@/lib/types/database";

type Row = Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role" | "verified_at" | "is_dev_account" | "created_at">;

const DESCRIPTIONS: Record<AppRole, string> = {
  owner: "Full control, including transferring ownership. Exactly one person.",
  admin: "Manage settings, departments, channels, roles and all logs.",
  staff: "Moderation tools: shifts, punishments, live players, commands.",
  department_leader: "Manage their own department's roster, ranks and channels.",
  member: "Chat, view departments, apply, take part in sessions.",
};

export function RolesManager({ members, me }: { members: Row[]; me: Profile }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const rows = members.filter((m) => !q || m.roblox_username.toLowerCase().includes(q.toLowerCase()));

  const setRole = (m: Row, role: AppRole) =>
    start(async () => {
      const r = await updateMemberRole(m.id, role);
      if (r.ok) { toast.success(`${m.roblox_username} is now ${ROLE_LABEL[role]}`); router.refresh(); } else toast.error(r.error);
    });

  const transfer = (m: Row) =>
    start(async () => {
      if (!confirm(`Transfer ownership to ${m.roblox_username}? You will become an Admin.`)) return;
      const r = await transferOwnership(m.id);
      if (r.ok) { toast.success("Ownership transferred"); router.refresh(); } else toast.error(r.error);
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div><CardTitle>Members & roles</CardTitle><CardDescription className="mt-1">{members.length} accounts</CardDescription></div>
          <div className="relative"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-48 pl-8" /></div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Verified</TableHead><TableHead>Role</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <UserAvatar username={m.roblox_username} avatarUrl={m.avatar_url} className="size-8" />
                      <div><p className="text-sm font-medium">{m.roblox_display_name ?? m.roblox_username}</p><p className="text-[11px] text-muted-foreground">@{m.roblox_username} · joined {new Date(m.created_at).toLocaleDateString()}</p></div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.is_dev_account ? <Badge variant="warning">dev account</Badge> : m.verified_at ? <Badge variant="success"><ShieldCheck className="size-3" /> Roblox</Badge> : <Badge variant="secondary">unverified</Badge>}
                  </TableCell>
                  <TableCell>
                    {m.role === "owner" || m.id === me.id ? (
                      <RoleBadge role={m.role} />
                    ) : (
                      <Select value={m.role} onValueChange={(v) => setRole(m, v as AppRole)} disabled={pending}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>{ASSIGNABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {me.role === "owner" && m.id !== me.id && (
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => transfer(m)}><Crown className="size-3.5" /> Make owner</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader><CardTitle>What each role can do</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(DESCRIPTIONS) as AppRole[]).map((r) => (
            <div key={r}><RoleBadge role={r} /><p className="mt-1 text-xs text-muted-foreground">{DESCRIPTIONS[r]}</p></div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
