"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/shared/user-avatar";
import { RoleBadge } from "@/components/shared/role-badge";
import { ROLE_LABEL } from "@/lib/permissions";
import { startDm } from "@/server/actions/messages";
import type { AppRole, Profile } from "@/lib/types/database";

export type DirectoryRow = Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role" | "bio" | "created_at" | "last_seen_at" | "verified_at"> & {
  departments: { id: string; name: string; color: string; slug: string; callsign: string | null; rank: string | null }[];
  on_duty: boolean;
};

export function MemberDirectory({ rows, departments, meId }: { rows: DirectoryRow[]; departments: { id: string; name: string; color: string; slug: string }[]; meId: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [dept, setDept] = useState("all");
  const [onlyDuty, setOnlyDuty] = useState(false);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!q || r.roblox_username.toLowerCase().includes(q.toLowerCase()) || (r.roblox_display_name ?? "").toLowerCase().includes(q.toLowerCase()) || r.departments.some((d) => (d.callsign ?? "").toLowerCase().includes(q.toLowerCase()))) &&
          (role === "all" || r.role === role) &&
          (dept === "all" || r.departments.some((d) => d.id === dept)) &&
          (!onlyDuty || r.on_duty),
      ),
    [rows, q, role, dept, onlyDuty],
  );

  const dm = (id: string) =>
    start(async () => {
      const r = await startDm(id);
      r.ok ? router.push(`/messages/${r.data}`) : toast.error(r.error);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input placeholder="Search name or callsign…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" /></div>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All roles</SelectItem>{(Object.keys(ROLE_LABEL) as AppRole[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All departments</SelectItem>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant={onlyDuty ? "default" : "outline"} size="sm" onClick={() => setOnlyDuty((v) => !v)}><span className={`size-1.5 rounded-full ${onlyDuty ? "bg-primary-foreground" : "bg-success"}`} /> On duty</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No members match" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <div key={m.id} className="flex gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
              <div className="relative">
                <UserAvatar username={m.roblox_username} avatarUrl={m.avatar_url} className="size-11" />
                {m.on_duty && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-success" title="On duty" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/members/${m.id}`} className="block truncate text-sm font-semibold hover:underline">{m.roblox_display_name ?? m.roblox_username}</Link>
                    <p className="truncate text-[11px] text-muted-foreground">@{m.roblox_username}</p>
                  </div>
                  <RoleBadge role={m.role} />
                </div>
                {m.bio && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{m.bio}</p>}
                {m.departments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.departments.map((d) => (
                      <Badge key={d.id} variant="outline" className="gap-1 border-border/80 text-[10px]" style={{ color: d.color }}>
                        <span className="size-1.5 rounded-full" style={{ background: d.color }} />{d.rank ? `${d.rank} · ` : ""}{d.name}{d.callsign ? ` · ${d.callsign}` : ""}
                      </Badge>
                    ))}
                  </div>
                )}
                {m.id !== meId && (
                  <Button variant="ghost" size="sm" className="mt-2 -ml-2 h-7 text-xs" onClick={() => dm(m.id)}><MessageSquare className="size-3.5" /> Message</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
