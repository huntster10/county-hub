import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/session";
import { runCommand } from "@/lib/erlc/client";
import { ErlcApiError } from "@/lib/erlc/types";
import { isStaff } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceRoleConfigured } from "@/lib/env";

const schema = z.object({ command: z.string().min(2).max(200) });

/** POST /api/erlc/command — staff only. Runs an in-game command. */
export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid command" }, { status: 400 });

  try {
    const { data } = await runCommand(parsed.data.command);
    if (isServiceRoleConfigured()) {
      void createAdminClient()
        .from("audit_log")
        .insert({ actor_id: profile.id, action: "erlc.command", target: parsed.data.command })
        .then(() => undefined);
    }
    return NextResponse.json({ ok: true, message: data.message });
  } catch (err) {
    const message = err instanceof ErlcApiError ? err.message : "Command failed";
    const status = err instanceof ErlcApiError && err.status ? err.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
