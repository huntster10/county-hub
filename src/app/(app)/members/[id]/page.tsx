import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Clock, ShieldCheck, Calendar, ExternalLink } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/permissions";
import { UserAvatar } from "@/components/shared/user-avatar";
import { RoleBadge } from "@/components/shared/role-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { minutesLabel } from "@/lib/utils";
import { ProfileActions } from "@/components/members/profile-actions";
import type { Profile, Shift } from "@/lib/types/database";

// Server Components render once per request, so reading the clock here is safe.
/* eslint-disable react-hooks/purity */
export default async function MemberPage({ params }: PageProps<"/members/[id]">) {
  const { id } = await params;
  const me = await requireProfile();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) notFound();
  const p = profile as Profile;

  const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [{ data: memberships }, { data: shifts }, { data: punishments }] = await Promise.all([
    supabase.from("department_members").select("callsign,status, department:departments(id,name,color,slug), rank:department_ranks!department_members_rank_id_fkey(name)").eq("profile_id", id),
    supabase.from("shifts").select("*").eq("profile_id", id).gte("started_at", monthAgo).order("started_at", { ascending: false }),
    isStaff(me.role) ? supabase.from("punishments").select("id,type,created_at").eq("moderator_id", id).gte("created_at", monthAgo) : Promise.resolve({ data: [] }),
  ]);

  type M = { callsign: string | null; status: string; department: { id: string; name: string; color: string; slug: string }; rank: { name: string } | null };
  const shiftRows = (shifts ?? []) as Shift[];
  const minutes = shiftRows.reduce((a, s) => a + Math.max(0, ((s.ended_at ? new Date(s.ended_at).getTime() : Date.now()) - new Date(s.started_at).getTime()) / 60000 - s.total_break_seconds / 60), 0);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <div className="relative mb-6 overflow-hidden rounded-xl border bg-card p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-5">
          <UserAvatar username={p.roblox_username} avatarUrl={p.avatar_url} className="size-20 text-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{p.roblox_display_name ?? p.roblox_username}</h1>
              <RoleBadge role={p.role} />
              {p.verified_at && <Badge variant="success"><ShieldCheck className="size-3" /> Roblox verified</Badge>}
              {p.is_dev_account && <Badge variant="warning">dev account</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              @{p.roblox_username}
              {p.roblox_id && !p.is_dev_account && <> · <a href={`https://www.roblox.com/users/${p.roblox_id}/profile`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 hover:text-primary">Roblox ID {p.roblox_id} <ExternalLink className="size-3" /></a></>}
            </p>
            {p.bio && <p className="mt-3 max-w-xl text-sm">{p.bio}</p>}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="size-3.5" /> Joined {format(new Date(p.created_at), "MMM d, yyyy")}</span>
              <span className="flex items-center gap-1"><Clock className="size-3.5" /> {minutesLabel(Math.round(minutes))} on duty (30 days)</span>
            </div>
          </div>
          <ProfileActions profile={p} isMe={me.id === p.id} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Departments</CardTitle></CardHeader>
          <CardContent>
            {!memberships?.length ? <p className="text-sm text-muted-foreground">Not in any department.</p> : (
              <ul className="space-y-2">
                {((memberships ?? []) as unknown as M[]).map((m) => (
                  <li key={m.department.id} className="flex items-center justify-between rounded-lg border bg-background/40 p-3">
                    <Link href={`/departments/${m.department.slug}`} className="flex items-center gap-2 text-sm font-medium hover:underline"><span className="size-2 rounded-full" style={{ background: m.department.color }} />{m.department.name}</Link>
                    <span className="text-xs text-muted-foreground">{m.rank?.name ?? "No rank"}{m.callsign ? ` · ${m.callsign}` : ""} · {m.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent shifts</CardTitle></CardHeader>
          <CardContent>
            {shiftRows.length === 0 ? <p className="text-sm text-muted-foreground">No shifts in the last 30 days.</p> : (
              <ul className="divide-y divide-border/60">
                {shiftRows.slice(0, 8).map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-muted-foreground">{format(new Date(s.started_at), "MMM d, p")}</span>
                    <span className="font-mono text-xs">{s.ended_at ? minutesLabel(Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000 - s.total_break_seconds / 60)) : <Badge variant="success">live</Badge>}</span>
                  </li>
                ))}
              </ul>
            )}
            {isStaff(me.role) && punishments && punishments.length > 0 && <p className="mt-3 text-xs text-muted-foreground">Logged {punishments.length} punishment{punishments.length === 1 ? "" : "s"} as a moderator in the last 30 days.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
