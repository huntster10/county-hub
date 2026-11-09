"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { isStaff } from "@/lib/permissions";
import type { ActionResult } from "./shifts";

const friendly = (m: string) => (m.includes("row-level security") ? "You don't have permission to do that." : m);

// ---- Applications -----------------------------------------------------------

const questionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200),
  type: z.enum(["short", "long", "select", "yesno"]),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

const formSchema = z.object({
  title: z.string().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
  departmentId: z.string().uuid().nullable().optional(),
  questions: z.array(questionSchema).min(1).max(25),
  isOpen: z.boolean().default(true),
});
export type FormInput = z.infer<typeof formSchema>;

export async function saveApplicationForm(input: FormInput, id?: string): Promise<ActionResult<string>> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = formSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid form" };
  const v = parsed.data;
  const supabase = await createClient();
  const row = { title: v.title, description: v.description ?? null, department_id: v.departmentId ?? null, questions: v.questions, is_open: v.isOpen };
  const res = id
    ? await supabase.from("application_forms").update(row).eq("id", id).select("id").single()
    : await supabase.from("application_forms").insert({ ...row, created_by: profile.id }).select("id").single();
  if (res.error) return { ok: false, error: friendly(res.error.message) };
  revalidatePath("/applications");
  return { ok: true, data: res.data.id as string };
}

export async function deleteApplicationForm(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("application_forms").delete().eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/applications");
  return { ok: true };
}

export async function submitApplication(formId: string, answers: Record<string, string>): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("applications").select("id").eq("form_id", formId).eq("applicant_id", profile.id).eq("status", "pending").maybeSingle();
  if (existing) return { ok: false, error: "You already have a pending application for this form." };
  const { error } = await supabase.from("applications").insert({ form_id: formId, applicant_id: profile.id, answers });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/applications");
  return { ok: true };
}

export async function reviewApplication(id: string, status: "accepted" | "denied", note?: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.from("applications").update({ status, review_note: note ?? null, reviewer_id: profile.id, reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };

  // Accepted into a department form? Add them to the roster automatically.
  if (status === "accepted") {
    const { data: app } = await supabase.from("applications").select("applicant_id, form:application_forms!applications_form_id_fkey(department_id)").eq("id", id).single();
    const deptId = (app as unknown as { applicant_id: string; form: { department_id: string | null } } | null)?.form?.department_id;
    if (app && deptId) {
      await supabase.from("department_members").upsert({ department_id: deptId, profile_id: app.applicant_id }, { onConflict: "department_id,profile_id", ignoreDuplicates: true });
    }
  }
  revalidatePath("/applications");
  return { ok: true };
}

// ---- Sessions & polls -------------------------------------------------------

const sessionSchema = z.object({
  title: z.string().min(2).max(80),
  scheduledFor: z.string().datetime().nullable().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function createSession(input: z.infer<typeof sessionSchema>): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) return { ok: false, error: "Staff only" };
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").insert({ title: parsed.data.title, scheduled_for: parsed.data.scheduledFor ?? null, notes: parsed.data.notes ?? null, host_id: profile.id });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/sessions");
  return { ok: true };
}

export async function setSessionStatus(id: string, status: "scheduled" | "active" | "ended", peakPlayers?: number): Promise<ActionResult> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === "active") patch.started_at = new Date().toISOString();
  if (status === "ended") {
    patch.ended_at = new Date().toISOString();
    if (peakPlayers !== undefined) patch.peak_players = peakPlayers;
  }
  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };

  // Announce in #session-updates.
  if (status !== "scheduled") {
    const profile = await getCurrentProfile();
    const [{ data: chan }, { data: session }] = await Promise.all([
      supabase.from("channels").select("id").eq("slug", "session-updates").maybeSingle(),
      supabase.from("sessions").select("title").eq("id", id).single(),
    ]);
    if (chan && session && profile) {
      await supabase.from("messages").insert({ channel_id: chan.id, author_id: profile.id, content: status === "active" ? `🟢 **Session started:** ${session.title} — join up!` : `🔴 **Session ended:** ${session.title}. Thanks for coming!` });
    }
  }
  revalidatePath("/sessions");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteSession(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/sessions");
  return { ok: true };
}

export async function createPoll(question: string, options: string[], sessionId?: string | null, closesAt?: string | null): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) return { ok: false, error: "Staff only" };
  const clean = options.map((o) => o.trim()).filter(Boolean);
  if (question.trim().length < 2 || clean.length < 2) return { ok: false, error: "A poll needs a question and at least two options." };
  const supabase = await createClient();
  const { error } = await supabase.from("polls").insert({ question: question.trim(), options: clean, session_id: sessionId ?? null, closes_at: closesAt ?? null, created_by: profile.id });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/sessions");
  return { ok: true };
}

export async function vote(pollId: string, optionIndex: number): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.from("poll_votes").upsert({ poll_id: pollId, profile_id: profile.id, option_index: optionIndex }, { onConflict: "poll_id,profile_id" });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/sessions");
  return { ok: true };
}

export async function deletePoll(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("polls").delete().eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/sessions");
  return { ok: true };
}

// ---- CAD / Dispatch ---------------------------------------------------------

const callSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(1000).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  priority: z.number().int().min(1).max(3).default(2),
  departmentId: z.string().uuid().nullable().optional(),
});

export async function createCall(input: z.infer<typeof callSchema>): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = callSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("cad_calls").insert({ title: v.title, description: v.description ?? null, location: v.location ?? null, priority: v.priority, department_id: v.departmentId ?? null, created_by: profile.id });
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/cad");
  return { ok: true };
}

export async function updateCall(id: string, patch: { status?: "pending" | "dispatched" | "on_scene" | "resolved" | "cancelled"; assignedTo?: string[]; priority?: number }): Promise<ActionResult> {
  const supabase = await createClient();
  const row: Record<string, unknown> = {};
  if (patch.status) row.status = patch.status;
  if (patch.assignedTo) row.assigned_to = patch.assignedTo;
  if (patch.priority) row.priority = patch.priority;
  const { error } = await supabase.from("cad_calls").update(row).eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/cad");
  return { ok: true };
}

/** Attach / detach yourself from a call. */
export async function toggleSelfAssign(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { data } = await supabase.from("cad_calls").select("assigned_to,status").eq("id", id).single();
  if (!data) return { ok: false, error: "Call not found" };
  const current = (data.assigned_to as string[]) ?? [];
  const next = current.includes(profile.id) ? current.filter((x) => x !== profile.id) : [...current, profile.id];
  const status = next.length > 0 && data.status === "pending" ? "dispatched" : data.status;
  const { error } = await supabase.from("cad_calls").update({ assigned_to: next, status }).eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };
  revalidatePath("/cad");
  return { ok: true };
}
