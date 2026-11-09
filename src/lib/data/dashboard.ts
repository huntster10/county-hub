import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/permissions";
import type { Profile, Punishment, Session, Shift } from "@/lib/types/database";

/** A running shift with its owner and department joined in (flat row from Supabase). */
export type OnlineStaffRow = Shift & {
  profile: Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role">;
  department: { name: string; color: string } | null;
};

export interface DashboardData {
  stats: {
    minutesToday: number;
    minutesWeek: number;
    activeStaff: number;
    punishmentsWeek: number;
    membersTotal: number;
    myMinutesWeek: number;
    weeklyQuota: number;
  };
  activityByDay: { day: string; total_minutes: number; unique_staff: number }[];
  departmentActivity: { department_id: string; name: string; color: string; total_minutes: number; members: number }[];
  onlineStaff: OnlineStaffRow[];
  recentPunishments: (Punishment & { moderator: { roblox_username: string } | null })[];
  recentMessages: {
    id: string;
    content: string;
    created_at: string;
    channel: { id: string; name: string } | null;
    author: { roblox_username: string; avatar_url: string | null } | null;
  }[];
  sessions: Session[];
}

export async function getDashboardData(profile: Profile, weeklyQuota: number): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const staff = isStaff(profile.role);

  const [
    byDayRes,
    byDayTodayRes,
    deptRes,
    onlineRes,
    membersRes,
    punishmentsRes,
    punishCountRes,
    messagesRes,
    sessionsRes,
    myShiftsRes,
  ] = await Promise.all([
    supabase.rpc("shift_minutes_by_day", { since: twoWeeksAgo }),
    supabase.rpc("shift_minutes_by_day", { since: startOfToday }),
    supabase.rpc("department_activity", { since: weekAgo }),
    supabase
      .from("shifts")
      .select("*, profile:profiles!shifts_profile_id_fkey(id,roblox_username,roblox_display_name,avatar_url,role), department:departments(name,color)")
      .neq("status", "ended")
      .order("started_at", { ascending: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    staff
      ? supabase
          .from("punishments")
          .select("*, moderator:profiles!punishments_moderator_id_fkey(roblox_username)")
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
    staff
      ? supabase.from("punishments").select("id", { count: "exact", head: true }).gte("created_at", weekAgo)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("messages")
      .select("id,content,created_at, channel:channels!messages_channel_id_fkey(id,name,type), author:profiles!messages_author_id_fkey(roblox_username,avatar_url)")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("sessions").select("*").neq("status", "ended").order("scheduled_for", { ascending: true }).limit(3),
    supabase.from("shifts").select("started_at,ended_at,total_break_seconds").eq("profile_id", profile.id).gte("started_at", weekAgo),
  ]);

  const byDay = (byDayRes.data ?? []) as DashboardData["activityByDay"];
  const todayRows = (byDayTodayRes.data ?? []) as DashboardData["activityByDay"];

  const myMinutesWeek = ((myShiftsRes.data ?? []) as Pick<Shift, "started_at" | "ended_at" | "total_break_seconds">[]).reduce(
    (acc, s) => {
      const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
      return acc + Math.max(0, (end - new Date(s.started_at).getTime()) / 60000 - s.total_break_seconds / 60);
    },
    0,
  );

  // Filter DM channels out of the "recent messages" widget.
  type Msg = DashboardData["recentMessages"][number] & { channel: { id: string; name: string; type: string } | null };
  const recentMessages = ((messagesRes.data ?? []) as unknown as Msg[]).filter((m) => m.channel && m.channel.type !== "dm");

  return {
    stats: {
      minutesToday: todayRows.reduce((a, r) => a + r.total_minutes, 0),
      minutesWeek: byDay.filter((r) => r.day >= weekAgo.slice(0, 10)).reduce((a, r) => a + r.total_minutes, 0),
      activeStaff: onlineRes.data?.length ?? 0,
      punishmentsWeek: punishCountRes.count ?? 0,
      membersTotal: membersRes.count ?? 0,
      myMinutesWeek: Math.round(myMinutesWeek),
      weeklyQuota,
    },
    activityByDay: byDay,
    departmentActivity: (deptRes.data ?? []) as DashboardData["departmentActivity"],
    onlineStaff: (onlineRes.data ?? []) as unknown as OnlineStaffRow[],
    recentPunishments: (punishmentsRes.data ?? []) as DashboardData["recentPunishments"],
    recentMessages,
    sessions: (sessionsRes.data ?? []) as Session[],
  };
}
