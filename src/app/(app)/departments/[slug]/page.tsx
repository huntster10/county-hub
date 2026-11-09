import { notFound } from "next/navigation";
import Link from "next/link";
import { Hash, Megaphone, Users, Clock, Trophy } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getDepartmentBySlug } from "@/lib/data/departments";
import { getMemberDirectory } from "@/lib/data/messages";
import { isAdmin } from "@/lib/permissions";
import { DeptIcon } from "@/components/shared/dept-icon";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { minutesLabel } from "@/lib/utils";
import { RosterTable } from "@/components/departments/roster-table";
import { RanksEditor } from "@/components/departments/ranks-editor";
import { DepartmentDialog } from "@/components/departments/department-dialog";

export default async function DepartmentPage({ params }: PageProps<"/departments/[slug]">) {
  const { slug } = await params;
  const profile = await requireProfile();
  const detail = await getDepartmentBySlug(slug);
  if (!detail) notFound();
  const { department, ranks, roster, channels, leaderboard } = detail;

  const canManage = isAdmin(profile.role) || department.leader_id === profile.id;
  const members = canManage ? await getMemberDirectory() : [];
  const activeCount = roster.filter((r) => r.status === "active").length;
  const weekMinutes = leaderboard.reduce((a, r) => a + r.total_minutes, 0);

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="relative mb-6 overflow-hidden rounded-xl border bg-card p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full opacity-20 blur-3xl" style={{ background: department.color }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex size-14 items-center justify-center rounded-xl" style={{ background: `${department.color}26`, color: department.color }}>
              <DeptIcon name={department.icon} className="size-7" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{department.name}</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">{department.description ?? "No description yet."}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="size-3.5" /> {activeCount} active · {roster.length} total</span>
                <span className="flex items-center gap-1"><Clock className="size-3.5" /> {minutesLabel(weekMinutes)} this week</span>
                {department.quota_minutes > 0 && <span>Quota: {minutesLabel(department.quota_minutes)}/week</span>}
                {department.leader && (
                  <span className="flex items-center gap-1.5">
                    <UserAvatar username={department.leader.roblox_username} avatarUrl={department.leader.avatar_url} className="size-4" />
                    Led by <Link href={`/members/${department.leader.id}`} className="font-medium text-foreground hover:underline">{department.leader.roblox_display_name ?? department.leader.roblox_username}</Link>
                  </span>
                )}
              </div>
            </div>
          </div>
          {canManage && <DepartmentDialog members={members} department={department} canDelete={isAdmin(profile.role)} />}
        </div>
      </div>

      <Tabs defaultValue="roster">
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          {canManage && <TabsTrigger value="ranks">Ranks</TabsTrigger>}
        </TabsList>

        <TabsContent value="roster">
          <RosterTable departmentId={department.id} roster={roster} ranks={ranks} members={members} canManage={canManage} meId={profile.id} />
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="size-4 text-chart-4" /> This week&apos;s leaderboard</CardTitle></CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <EmptyState icon={Clock} title="No shifts this week" description="Members who clock in under this department will appear here." className="border-0" />
              ) : (
                <ol className="divide-y divide-border/60">
                  {leaderboard.map((r, i) => {
                    const pct = department.quota_minutes > 0 ? Math.min(100, Math.round((r.total_minutes / department.quota_minutes) * 100)) : null;
                    return (
                      <li key={r.profile_id} className="flex items-center gap-3 py-2.5">
                        <span className={`w-6 text-center text-sm font-semibold ${i === 0 ? "text-chart-4" : i === 1 ? "text-muted-foreground" : i === 2 ? "text-chart-2" : "text-muted-foreground/60"}`}>{i + 1}</span>
                        <UserAvatar username={r.roblox_username} avatarUrl={r.avatar_url} className="size-8" />
                        <div className="min-w-0 flex-1">
                          <Link href={`/members/${r.profile_id}`} className="text-sm font-medium hover:underline">{r.roblox_username}</Link>
                          <p className="text-[11px] text-muted-foreground">{r.shift_count} shift{r.shift_count === 1 ? "" : "s"}</p>
                        </div>
                        {pct !== null && (
                          <div className="hidden w-32 sm:block">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className={`h-full ${pct >= 100 ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>
                            <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{pct}% of quota</p>
                          </div>
                        )}
                        <span className="font-mono text-sm">{minutesLabel(r.total_minutes)}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="channels">
          <Card>
            <CardContent className="p-2">
              {channels.length === 0 ? (
                <EmptyState icon={Hash} title="No department channels" className="border-0" />
              ) : (
                <ul>
                  {channels.map((c) => (
                    <li key={c.id}>
                      <Link href={`/messages/${c.id}`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent">
                        {c.type === "announcement" ? <Megaphone className="size-4 text-muted-foreground" /> : <Hash className="size-4 text-muted-foreground" />}
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canManage && (
          <TabsContent value="ranks">
            <RanksEditor departmentId={department.id} ranks={ranks} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
