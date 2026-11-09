/**
 * Central place to read environment variables.
 *
 * Nothing here throws at import time, so `next build` works before you have
 * created a Supabase project. Pages check `isSupabaseConfigured()` and show a
 * friendly setup screen instead of crashing.
 */

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  // Supabase projects created recently use a "publishable" key; older ones an
  // "anon" key. Both work the same way, so we accept either name.
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "",

  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  robloxClientId: process.env.ROBLOX_CLIENT_ID ?? "",
  robloxClientSecret: process.env.ROBLOX_CLIENT_SECRET ?? "",

  /** Fallback ER:LC key; the Settings page value (stored in the DB) wins if set. */
  erlcApiKey: process.env.ERLC_API_KEY ?? "",

  /** Set to "true" to show the password-less developer login on /login. */
  devLoginEnabled: process.env.DEV_LOGIN_ENABLED === "true",
};

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

export function isServiceRoleConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseServiceKey);
}

export function isRobloxOAuthConfigured() {
  return Boolean(env.robloxClientId && env.robloxClientSecret);
}
