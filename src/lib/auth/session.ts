import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasRoleAtLeast, isStaff } from "@/lib/permissions";
import type { AppRole, Profile } from "@/lib/types/database";

/**
 * Returns the signed-in user's profile, or null when nobody is signed in.
 * Wrapped in React `cache` so several components in one request share one query.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile | null) ?? null;
});

/** Like getCurrentProfile but sends anonymous visitors to the login page. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Require a minimum role; sends lower roles back to the dashboard. */
export async function requireRole(min: AppRole): Promise<Profile> {
  const profile = await requireProfile();
  if (!hasRoleAtLeast(profile.role, min)) redirect("/dashboard?denied=1");
  return profile;
}

/** Require moderation staff (owner/admin/staff). */
export async function requireStaff(): Promise<Profile> {
  const profile = await requireProfile();
  if (!isStaff(profile.role)) redirect("/dashboard?denied=1");
  return profile;
}
