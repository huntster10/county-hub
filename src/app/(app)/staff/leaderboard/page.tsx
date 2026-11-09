import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Clock } from "lucide-react";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { minutesLabel } from "@/lib/utils";
import { LeaderboardChart } from "@/components/staff/leaderboard-chart";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Leaderboard" };

// Server Components render once per request, so reading the clock here is safe.
/* eslint-disable react-hooks/purity */
export default async function LeaderboardPage({ searchParams }: PageProps<"/staff/leaderboard">) {
  await requireStaff();
  const params = await searchParams;
  const days = params.days === "30" ? 30 : params.days === "90" ? 90 : 7;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const supabase = await createClient();
  const [{ data }, settings] = await Promise.all([supabase.rpc("shift_leaderboard", { since }), getServerSettings()]);
  const rows = (data ?? []) as { profile_id: string; roblox_username: string; avatar_url: string | null; total_minutes: number; shift_count: number }[];
  const quota = settings.weekly_quota_minutes * (days / 7);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Staff leaderboard"
        description="Ranked by time on duty. Quota progress uses the weekly quota from Settings, scaled to the period."
        actions={
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {[7, 30, 90].map((d) => (
              <Button key={d} asChild size="sm" variant={days === d ? "default" : "ghost"}><Link href={`/staff/leaderboard?days=${d}`}>{d} days</Link></Button>
            ))}
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon={Trophy} title="No shifts in this period" description="Once staff start clocking in, rankings appear here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardContent className="p-0">
              <ol className="divide-y divide-border/60">
                {rows.map((r, i) => {
                  const pct = quota > 0 ? Math.min(100, Math.round((r.total_minutes / quota) * 100)) : null;
                  return (
                    <li key={r.profile_id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`w-7 text-center text-lg font-bold ${i === 0 ? "text-chart-4" : i === 1 ? "text-muted-foreground" : i === 2 ? "text-chart-2" : "text-muted-foreground/50"}`}>{i + 1}</span>
                      <UserAvatar username={r.roblox_username} avatarUrl={r.avatar_url} className="size-9" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/members/${r.profile_id}`} className="text-sm font-medium hover:underline">{r.roblox_username}</Link>
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="size-3" /> {r.shift_count} shift{r.shift_count === 1 ? "" : "s"}</p>
                      </div>
                      {pct !== null && (
                        <div className="hidden w-36 sm:block">
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full ${pct >= 100 ? "bg-success" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div>
                          <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{pct}% of quota</p>
                        </div>
                      )}
                      {pct !== null && pct >= 100 && <Badge variant="success">Quota met</Badge>}
                      <span className="w-20 text-right font-mono text-sm">{minutesLabel(r.total_minutes)}</span>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardContent className="pt-5">
              <p className="mb-3 text-sm font-semibold">Top 10 — hours on duty</p>
              <LeaderboardChart rows={rows.slice(0, 10)} quota={quota} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
