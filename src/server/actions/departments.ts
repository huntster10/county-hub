"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { isAdmin } from "@/lib/permissions";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "./shifts";

const deptSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(300).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3987e5"),
  icon: z.string().max(30).default("shield"),
  leaderId: z.string().uuid().nullable().optional(),
  quotaMinutes: z.number().int().min(0).max(10080).default(0),
});
export type DepartmentInput = z.infer<typeof deptSchema>;

const friendly = (msg: string) =>
  msg.includes("row-level security") ? "You don't have permission to do that." : msg.includes("duplicate") ? "That name is already taken." : msg;

export async function createDepartment(input: DepartmentInput): Promise<ActionResult<string>> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile.role)) return { ok: false, error: "Admins only" };
  const parsed = deptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();
  const { data: maxPos } = await supabase.from("departments").select("position").order("position", { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await supabase
    .from("departments")
    .insert({
      name: v.name,
      slug: slugify(v.name),
      description: v.description ?? null,
      color: v.color,
      icon: v.icon,
      leader_id: v.leaderId ?? null,
      quota_minutes: v.quotaMinutes,
      position: ((maxPos?.position as number | undefined) ?? 0) + 1,
    })
    .select("slug")
    .single();
  if (error) return { ok: false, error: friendly(error.message) };

  // Every department gets a category with a chat + announcements channel.
  const { data: dept } = await supabase.from("departments").select("id").eq("slug", data.slug).single();
  if (dept) {
    const { data: cat } = await supabase
      .from("channel_categories")
      .insert({ name: v.name, department_id: dept.id, position: 20 })
      .select("id")
      .single();
    await supabase.from("channels").insert([
      { category_id: cat?.id, department_id: dept.id, name: `${data.slug}-announcements`, slug: `${data.slug}-announcements`, type: "announcement", topic: `${v.name} announcements.`, position: 0, created_by: profile.id },
      { category_id: cat?.id, department_id: dept.id, name: `dept-${data.slug}`, slug: `dept-${data.slug}`, type: "text", topic: `${v.name} department chat.`, position: 1, created_by: profile.id },
    ]);
    // Default ranks so the roster is usable immediately.
    await supabase.from("department_ranks").insert([
      { department_id: dept.id, name: "Director", level: 100 },
      { department_id: dept.id, name: "Supervisor", level: 70 },
      { department_id: dept.id, name: "Member", level: 40 },
      { department_id: dept.id, name: "Trainee", level: 10 },
    ]);
    if (v.leaderId) await supabase.from("department_members").insert({ department_id: dept.id, profile_id: v.leaderId });
  }

  revalidatePath("/departments");
  revalidatePath("/", "layout");
  return { ok: true, data: data.slug as string };
}

export async function updateDepartment(id: string, input: Partial<DepartmentInput>): Promise<ActionResult> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.color !== undefined) patch.color = input.color;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.leaderId !== undefined) patch.leader_id = input.leaderId;
  if (input.quotaMinutes !== undefined) patch.quota_minutes = input.quotaMinutes;
  const { error } = await supabase.from("departments").update(patch).eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/departments");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteDepartment(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile.role)) return { ok: false, error: "Admins only" };
  const supabase = await createClient();
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/departments");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---- Ranks ----------------------------------------------------------------

export async function addRank(departmentId: string, name: string, level: number): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("department_ranks").insert({ department_id: departmentId, name: name.trim().slice(0, 40), level });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/departments");
  return { ok: true };
}

export async function updateRank(id: string, patch: { name?: string; level?: number }): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("department_ranks").update(patch).eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/departments");
  return { ok: true };
}

export async function deleteRank(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("department_ranks").delete().eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/departments");
  return { ok: true };
}

// ---- Roster ---------------------------------------------------------------

const memberPatch = z.object({
  rankId: z.string().uuid().nullable().optional(),
  callsign: z.string().max(20).nullable().optional(),
  status: z.enum(["active", "loa", "inactive", "suspended"]).optional(),
});

export async function addDepartmentMember(departmentId: string, profileId: string, rankId?: string | null, callsign?: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("department_members")
    .insert({ department_id: departmentId, profile_id: profileId, rank_id: rankId ?? null, callsign: callsign ?? null });
  if (error) return { ok: false, error: error.message.includes("duplicate") ? "They're already on this roster." : friendly(error.message) };
  revalidatePath("/departments");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateDepartmentMember(id: string, input: z.infer<typeof memberPatch>): Promise<ActionResult> {
  const parsed = memberPatch.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (parsed.data.rankId !== undefined) patch.rank_id = parsed.data.rankId;
  if (parsed.data.callsign !== undefined) patch.callsign = parsed.data.callsign;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  const { error } = await supabase.from("department_members").update(patch).eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/departments");
  return { ok: true };
}

export async function removeDepartmentMember(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("department_members").delete().eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/departments");
  revalidatePath("/", "layout");
  return { ok: true };
}
