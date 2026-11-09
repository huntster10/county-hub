"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/types/database";
import type { ActionResult } from "./shifts";

const schema = z.object({
  communityName: z.string().min(2).max(60),
  erlcApiKey: z.string().max(200).nullable().optional(),
  robloxGroupId: z.number().int().positive().nullable().optional(),
  requireGroupMembership: z.boolean(),
  weeklyQuotaMinutes: z.number().int().min(0).max(10080),
  joinCodeVisibleTo: z.enum(["owner", "admin", "staff", "department_leader", "member"]),
});
export type SettingsInput = z.infer<typeof schema>;

export async function updateSettings(input: SettingsInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile.role)) return { ok: false, error: "Admins only" };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;

  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    community_name: v.communityName,
    roblox_group_id: v.robloxGroupId ?? null,
    require_group_membership: v.requireGroupMembership,
    weekly_quota_minutes: v.weeklyQuotaMinutes,
    join_code_visible_to: v.joinCodeVisibleTo,
  };
  // Only overwrite the key when a new one was typed (the form never shows the stored key).
  if (v.erlcApiKey !== undefined && v.erlcApiKey !== null) patch.erlc_api_key = v.erlcApiKey.trim() || null;

  const { error } = await supabase.from("server_settings").update(patch).eq("id", 1);
  if (error) return { ok: false, error: error.message };

  try {
    await createAdminClient().from("audit_log").insert({ actor_id: profile.id, action: "settings.update", metadata: { keys: Object.keys(patch) } });
  } catch { /* audit is best-effort */ }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearErlcApiKey(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile.role)) return { ok: false, error: "Admins only" };
  const supabase = await createClient();
  const { error } = await supabase.from("server_settings").update({ erlc_api_key: null }).eq("id", 1);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

/** Test the ER:LC key currently stored (or typed) without saving anything. */
export async function testErlcKey(key?: string): Promise<ActionResult<{ name: string; players: number }>> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile.role)) return { ok: false, error: "Admins only" };
  const { getErlcApiKey } = await import("@/lib/settings");
  const useKey = key?.trim() || (await getErlcApiKey());
  if (!useKey) return { ok: false, error: "No key to test" };
  try {
    const res = await fetch("https://api.erlc.gg/v1/server", { headers: { "server-key": useKey }, cache: "no-store" });
    if (res.status === 403) return { ok: false, error: "ER:LC rejected that key (403). Double-check it in-game." };
    if (!res.ok) return { ok: false, error: `ER:LC returned ${res.status}` };
    const json = (await res.json()) as { Name: string; CurrentPlayers: number };
    return { ok: true, data: { name: json.Name, players: json.CurrentPlayers } };
  } catch {
    return { ok: false, error: "Could not reach api.erlc.gg" };
  }
}

export async function updateMemberRole(profileId: string, role: AppRole): Promise<ActionResult> {
  const me = await getCurrentProfile();
  if (!me || !isAdmin(me.role)) return { ok: false, error: "Admins only" };
  if (role === "owner") return { ok: false, error: "Use “Transfer ownership” to change the owner." };
  if (profileId === me.id) return { ok: false, error: "You can't change your own role." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", profileId);
  if (error) return { ok: false, error: error.message.includes("owner") ? "Only the owner can change the owner's role." : error.message };
  revalidatePath("/settings");
  revalidatePath("/members");
  return { ok: true };
}

export async function transferOwnership(toProfileId: string): Promise<ActionResult> {
  const me = await getCurrentProfile();
  if (!me || me.role !== "owner") return { ok: false, error: "Only the current owner can do this." };
  const supabase = await createClient();
  const { error: e1 } = await supabase.from("profiles").update({ role: "owner" }).eq("id", toProfileId);
  if (e1) return { ok: false, error: e1.message };
  const { error: e2 } = await supabase.from("profiles").update({ role: "admin" }).eq("id", me.id);
  if (e2) return { ok: false, error: e2.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
