import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Channel, Department, Profile } from "@/lib/types/database";

/**
 * Everything the app shell (sidebar + topbar) needs, fetched in parallel.
 */
export async function getLayoutData(profile: Profile) {
  const supabase = await createClient();

  const [departmentsRes, myDeptsRes, channelsRes, unreadRes] = await Promise.all([
    supabase.from("departments").select("id,name,slug,color,icon").order("position"),
    supabase.from("department_members").select("department_id").eq("profile_id", profile.id).neq("status", "suspended"),
    supabase.from("channels").select("id,name,type").neq("type", "dm").order("position"),
    supabase.rpc("unread_counts"),
  ]);

  const departments = (departmentsRes.data ?? []) as Pick<Department, "id" | "name" | "slug" | "color" | "icon">[];
  const myDeptIds = new Set(((myDeptsRes.data ?? []) as { department_id: string }[]).map((d) => d.department_id));
  const myDepartments = departments.filter((d) => myDeptIds.has(d.id));
  const channels = (channelsRes.data ?? []) as Pick<Channel, "id" | "name" | "type">[];
  const unreadTotal = ((unreadRes.data ?? []) as { channel_id: string; unread: number }[]).reduce((a, r) => a + r.unread, 0);

  return { departments, myDepartments, channels, unreadTotal };
}
