import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { getServerSnapshot } from "@/lib/erlc/client";
import { ErlcApiError } from "@/lib/erlc/types";
import { syncGameEvents } from "@/lib/erlc/sync";
import { isStaff, hasRoleAtLeast } from "@/lib/permissions";
import { getServerSettings } from "@/lib/settings";

/**
 * GET /api/erlc/status
 * Live snapshot of the private server for dashboard widgets. Everyone signed in
 * can see the basics; logs and the join code are filtered by role.
 */
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const [{ data, rate, cached }, settings] = await Promise.all([getServerSnapshot({ force }), getServerSettings()]);

    // Store logs in the background for history (staff endpoints read them later).
    if (!cached) void syncGameEvents(data);

    const staff = isStaff(profile.role);
    const canSeeJoinCode = hasRoleAtLeast(profile.role, settings.join_code_visible_to);

    return NextResponse.json({
      configured: true,
      fetchedAt: new Date().toISOString(),
      rate,
      server: {
        Name: data.Name,
        CurrentPlayers: data.CurrentPlayers,
        MaxPlayers: data.MaxPlayers,
        JoinKey: canSeeJoinCode ? data.JoinKey : null,
        TeamBalance: data.TeamBalance,
        AccVerifiedReq: data.AccVerifiedReq,
        OwnerId: data.OwnerId,
      },
      players: data.Players ?? [],
      queue: data.Queue ?? [],
      staff: data.Staff ?? null,
      vehicles: staff ? data.Vehicles ?? [] : [],
      logs: staff
        ? {
            joins: data.JoinLogs ?? [],
            kills: data.KillLogs ?? [],
            commands: data.CommandLogs ?? [],
            modCalls: data.ModCalls ?? [],
          }
        : null,
    });
  } catch (err) {
    if (err instanceof ErlcApiError) {
      return NextResponse.json({ configured: err.status !== 0, error: err.message }, { status: err.status === 0 ? 200 : 502 });
    }
    console.error("[erlc status]", err);
    return NextResponse.json({ configured: true, error: "Could not reach the ER:LC API." }, { status: 502 });
  }
}
