import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client. BYPASSES Row Level Security.
 *
 * Only use this on the server for jobs that genuinely need it:
 *  - creating auth users after Roblox OAuth
 *  - reading the ER:LC API key from server_settings
 *  - writing cached game events / audit log entries
 *
 * Never import this file from a Client Component (the "server-only" import
 * above makes Next.js fail the build if you try).
 */
export function createAdminClient() {
  if (!env.supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (see README).");
  }
  return createSupabaseClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
