import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/data/dashboard";
import { getActiveShift } from "@/server/actions/shifts";
import { getServerSettings } from "@/lib/settings";
import { isStaff } from "@/lib/permissions";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { StatTiles } from "@/components/dashboard/widgets/stat-tiles";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const profile = await requireProfile();
  const params = await searchParams;
  const settings = await getServerSettings();
  const [data, activeShift] = await Promise.all([getDashboardData(profile, settings.weekly_quota_minutes), getActiveShift()]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-4 md:p-6">
      {params.denied && (
        <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          You don&apos;t have permission to view that page.
        </div>
      )}
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">
          {greeting}, {profile.roblox_display_name ?? profile.roblox_username}
        </h1>
        <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening in {settings.community_name} right now.</p>
      </div>

      <div className="mb-4">
        <StatTiles stats={data.stats} staff={isStaff(profile.role)} />
      </div>

      <DashboardGrid profile={profile} data={data} activeShift={activeShift} />
    </div>
  );
}
