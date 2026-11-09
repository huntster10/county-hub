"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import type { DashboardLayout } from "@/lib/types/database";
import type { ActionResult } from "./shifts";

export async function saveDashboardLayout(layout: DashboardLayout): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ dashboard_layout: layout }).eq("id", profile.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateBio(bio: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ bio: bio.slice(0, 300) }).eq("id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/members");
  return { ok: true };
}
