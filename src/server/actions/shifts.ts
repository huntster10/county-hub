"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import type { Shift } from "@/lib/types/database";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/** The signed-in user's shift that is still running (active or on break). */
export async function getActiveShift(): Promise<Shift | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("shifts")
    .select("*")
    .eq("profile_id", profile.id)
    .neq("status", "ended")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as Shift | null) ?? null;
}

export async function startShift(departmentId?: string | null): Promise<ActionResult<Shift>> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const existing = await getActiveShift();
  if (existing) return { ok: false, error: "You already have a shift running." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shifts")
    .insert({ profile_id: profile.id, department_id: departmentId ?? null, status: "active" })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, data: data as Shift };
}

export async function endShift(notes?: string): Promise<ActionResult> {
  const shift = await getActiveShift();
  if (!shift) return { ok: false, error: "No shift is running." };
  const supabase = await createClient();

  // Close any open break first so the break total is accurate.
  let extraBreak = 0;
  if (shift.status === "on_break") {
    const { data: openBreak } = await supabase
      .from("shift_breaks")
      .select("*")
      .eq("shift_id", shift.id)
      .is("ended_at", null)
      .maybeSingle();
    if (openBreak) {
      extraBreak = Math.floor((Date.now() - new Date(openBreak.started_at as string).getTime()) / 1000);
      await supabase.from("shift_breaks").update({ ended_at: new Date().toISOString() }).eq("id", openBreak.id);
    }
  }

  const { error } = await supabase
    .from("shifts")
    .update({
      status: "ended",
      ended_at: new Date().toISOString(),
      total_break_seconds: shift.total_break_seconds + extraBreak,
      notes: notes ?? shift.notes,
    })
    .eq("id", shift.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleBreak(): Promise<ActionResult<"on_break" | "active">> {
  const shift = await getActiveShift();
  if (!shift) return { ok: false, error: "No shift is running." };
  const supabase = await createClient();

  if (shift.status === "active") {
    const { error } = await supabase.from("shift_breaks").insert({ shift_id: shift.id });
    if (error) return { ok: false, error: error.message };
    await supabase.from("shifts").update({ status: "on_break" }).eq("id", shift.id);
    revalidatePath("/", "layout");
    return { ok: true, data: "on_break" };
  }

  const { data: openBreak } = await supabase
    .from("shift_breaks")
    .select("*")
    .eq("shift_id", shift.id)
    .is("ended_at", null)
    .maybeSingle();
  let seconds = 0;
  if (openBreak) {
    seconds = Math.floor((Date.now() - new Date(openBreak.started_at as string).getTime()) / 1000);
    await supabase.from("shift_breaks").update({ ended_at: new Date().toISOString() }).eq("id", openBreak.id);
  }
  const { error } = await supabase
    .from("shifts")
    .update({ status: "active", total_break_seconds: shift.total_break_seconds + seconds })
    .eq("id", shift.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, data: "active" };
}

/** Admin: delete a shift record (e.g. a forgotten clock-out). */
export async function deleteShift(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff/shifts");
  return { ok: true };
}
