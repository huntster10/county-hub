import { NextResponse } from "next/server";
import { isRobloxOAuthConfigured, isServiceRoleConfigured, isSupabaseConfigured, env } from "@/lib/env";

/** Quick check of what is configured. Visit /api/health in your browser. */
export function GET() {
  return NextResponse.json({
    ok: true,
    supabase: isSupabaseConfigured(),
    serviceRole: isServiceRoleConfigured(),
    robloxOAuth: isRobloxOAuthConfigured(),
    devLogin: env.devLoginEnabled,
    erlcKeyInEnv: Boolean(env.erlcApiKey),
  });
}
