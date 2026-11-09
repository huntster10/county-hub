"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { isStaff, isAdmin } from "@/lib/permissions";
import type { Punishment } from "@/lib/types/database";
import type { ActionResult } from "./shifts";

const schema = z.object({
  type: z.enum(["warning", "kick", "ban", "note", "bolo"]),
  targetUsername: z.string().min(3).max(20),
  targetRobloxId: z.number().int().positive().nullable().optional(),
  reason: z.string().min(3).max(1000),
  evidenceUrl: z.string().url().nullable().optional().or(z.literal("")),
  durationMinutes: z.number().int().positive().nullable().optional(),
});
export type PunishmentInput = z.infer<typeof schema>;

/** Look up a Roblox user id from a username via Roblox's public API. */
async function lookupRobloxId(username: string): Promise<number | null> {
  try {
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { id: number }[] };
    return json.data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

export async function createPunishment(input: PunishmentInput): Promise<ActionResult<Punishment>> {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) return { ok: false, error: "Staff only" };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;

  const robloxId = v.targetRobloxId ?? (await lookupRobloxId(v.targetUsername));
  const expiresAt = v.durationMinutes ? new Date(Date.now() + v.durationMinutes * 60_000).toISOString() : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("punishments")
    .insert({
      type: v.type,
      target_username: v.targetUsername,
      target_roblox_id: robloxId,
      reason: v.reason,
      evidence_url: v.evidenceUrl || null,
      moderator_id: profile.id,
      duration_minutes: v.durationMinutes ?? null,
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  // Mirror into #mod-logs so staff see it in chat too.
  const { data: modLogs } = await supabase.from("channels").select("id").eq("slug", "mod-logs").maybeSingle();
  if (modLogs) {
    await supabase.from("messages").insert({
      channel_id: modLogs.id,
      author_id: profile.id,
      content: `**${v.type.toUpperCase()}** · ${v.targetUsername} — ${v.reason}${v.durationMinutes ? ` (${v.durationMinutes} min)` : ""}`,
      embeds: [],
      attachments: [],
    });
  }

  revalidatePath("/staff/punishments");
  revalidatePath("/dashboard");
  return { ok: true, data: data as Punishment };
}

export async function setPunishmentActive(id: string, active: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("punishments").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/punishments");
  return { ok: true };
}

export async function deletePunishment(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile.role)) return { ok: false, error: "Admins only" };
  const supabase = await createClient();
  const { error } = await supabase.from("punishments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/punishments");
  return { ok: true };
}

/** Full history for one player (used by the punishment search). */
export async function getPlayerHistory(username: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("punishments")
    .select("*, moderator:profiles!punishments_moderator_id_fkey(roblox_username)")
    .ilike("target_username", username)
    .order("created_at", { ascending: false });
  return (data ?? []) as (Punishment & { moderator: { roblox_username: string } | null })[];
}
