import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { isStaff } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/erlc/logs?kind=join&limit=100
 * Historical game events stored by the sync job (staff only).
 */
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const kind = request.nextUrl.searchParams.get("kind");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 100), 500);

  const supabase = await createClient();
  let query = supabase.from("game_events").select("*").order("occurred_at", { ascending: false }).limit(limit);
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data });
}
