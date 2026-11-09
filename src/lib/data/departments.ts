import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Channel, Department, DepartmentRank, Profile, RosterRow } from "@/lib/types/database";

export type DepartmentCard = Department & {
  leader: Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url"> | null;
  member_count: number;
  minutes_week: number;
};

export async function getDepartmentCards(): Promise<DepartmentCard[]> {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [deptRes, activityRes] = await Promise.all([
    supabase
      .from("departments")
      .select("*, leader:profiles!departments_leader_id_fkey(id,roblox_username,roblox_display_name,avatar_url)")
      .order("position"),
    supabase.rpc("department_activity", { since: weekAgo }),
  ]);
  const activity = (activityRes.data ?? []) as { department_id: string; total_minutes: number; members: number }[];
  return ((deptRes.data ?? []) as unknown as (Department & { leader: DepartmentCard["leader"] })[]).map((d) => {
    const a = activity.find((x) => x.department_id === d.id);
    return { ...d, member_count: a?.members ?? 0, minutes_week: a?.total_minutes ?? 0 };
  });
}

export interface DepartmentDetail {
  department: Department & { leader: DepartmentCard["leader"] };
  ranks: DepartmentRank[];
  roster: RosterRow[];
  channels: Pick<Channel, "id" | "name" | "type">[];
  leaderboard: { profile_id: string; roblox_username: string; avatar_url: string | null; total_minutes: number; shift_count: number }[];
}

export async function getDepartmentBySlug(slug: string): Promise<DepartmentDetail | null> {
  const supabase = await createClient();
  const { data: dept } = await supabase
    .from("departments")
    .select("*, leader:profiles!departments_leader_id_fkey(id,roblox_username,roblox_display_name,avatar_url)")
    .eq("slug", slug)
    .maybeSingle();
  if (!dept) return null;

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [ranksRes, rosterRes, channelsRes, shiftsRes] = await Promise.all([
    supabase.from("department_ranks").select("*").eq("department_id", dept.id).order("level", { ascending: false }),
    supabase
      .from("department_members")
      .select("*, profile:profiles!department_members_profile_id_fkey(id,roblox_username,roblox_display_name,avatar_url,role), rank:department_ranks!department_members_rank_id_fkey(id,name,level)")
      .eq("department_id", dept.id),
    supabase.from("channels").select("id,name,type").eq("department_id", dept.id).order("position"),
    supabase
      .from("shifts")
      .select("profile_id,started_at,ended_at,total_break_seconds, profile:profiles!shifts_profile_id_fkey(roblox_username,avatar_url)")
      .eq("department_id", dept.id)
      .gte("started_at", weekAgo),
  ]);

  // Build the department leaderboard from this week's shifts.
  type ShiftRow = { profile_id: string; started_at: string; ended_at: string | null; total_break_seconds: number; profile: { roblox_username: string; avatar_url: string | null } };
  const totals = new Map<string, DepartmentDetail["leaderboard"][number]>();
  for (const s of (shiftsRes.data ?? []) as unknown as ShiftRow[]) {
    const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
    const minutes = Math.max(0, (end - new Date(s.started_at).getTime()) / 60000 - s.total_break_seconds / 60);
    const row = totals.get(s.profile_id) ?? { profile_id: s.profile_id, roblox_username: s.profile.roblox_username, avatar_url: s.profile.avatar_url, total_minutes: 0, shift_count: 0 };
    row.total_minutes += minutes;
    row.shift_count += 1;
    totals.set(s.profile_id, row);
  }
  const leaderboard = [...totals.values()].map((r) => ({ ...r, total_minutes: Math.round(r.total_minutes) })).sort((a, b) => b.total_minutes - a.total_minutes);

  // Sort roster by rank level (desc) then name.
  const roster = ((rosterRes.data ?? []) as unknown as RosterRow[]).sort(
    (a, b) => (b.rank?.level ?? -1) - (a.rank?.level ?? -1) || a.profile.roblox_username.localeCompare(b.profile.roblox_username),
  );

  return {
    department: dept as unknown as DepartmentDetail["department"],
    ranks: (ranksRes.data ?? []) as DepartmentRank[],
    roster,
    channels: (channelsRes.data ?? []) as DepartmentDetail["channels"],
    leaderboard,
  };
}
