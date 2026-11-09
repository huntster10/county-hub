import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, isServiceRoleConfigured } from "@/lib/env";
import type { ServerSettings } from "@/lib/types/database";

const DEFAULTS: ServerSettings = {
  id: 1,
  community_name: "County Hub",
  erlc_api_key: null,
  roblox_group_id: null,
  require_group_membership: false,
  default_role: "member",
  weekly_quota_minutes: 0,
  join_code_visible_to: "member",
  updated_at: new Date(0).toISOString(),
};

/**
 * Community-wide settings. Read with the service role because the row holds
 * the ER:LC API key and RLS hides it from non-admins.
 */
export async function getServerSettings(): Promise<ServerSettings> {
  if (!isServiceRoleConfigured()) return DEFAULTS;
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("server_settings").select("*").eq("id", 1).maybeSingle();
    return { ...DEFAULTS, ...((data as Partial<ServerSettings>) ?? {}) };
  } catch {
    return DEFAULTS;
  }
}

/** The ER:LC key to use: Settings page value first, then the .env fallback. */
export async function getErlcApiKey(): Promise<string | null> {
  const settings = await getServerSettings();
  return settings.erlc_api_key || env.erlcApiKey || null;
}
