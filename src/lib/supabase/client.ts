"use client";

import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/**
 * Supabase client for use inside Client Components ("use client").
 * It talks to Supabase directly from the browser using the user's session
 * cookie, so Row Level Security applies automatically.
 */
export function createClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}
