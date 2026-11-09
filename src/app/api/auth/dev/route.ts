import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { signInAsRoblox } from "@/lib/auth/create-session";

const schema = z.object({
  username: z.string().min(3).max(20).regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and _ only"),
  role: z.enum(["owner", "admin", "staff", "department_leader", "member"]).default("member"),
});

/**
 * Developer login — ONLY for local testing before Roblox OAuth is set up.
 * Enabled by DEV_LOGIN_ENABLED=true in .env.local. Creates a fake account with
 * the username you type. The very first account on a fresh database becomes
 * the Owner automatically.
 */
export async function POST(request: NextRequest) {
  if (!env.devLoginEnabled) {
    return NextResponse.json({ error: "Dev login is disabled" }, { status: 403 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  try {
    // Dev accounts get a fake, obviously-not-real Roblox id derived from the name.
    const fakeId = String(900000000 + [...parsed.data.username].reduce((a, c) => a + c.charCodeAt(0), 0));
    await signInAsRoblox({
      robloxId: fakeId,
      username: parsed.data.username,
      displayName: parsed.data.username,
      avatarUrl: null,
      verified: false,
      isDevAccount: true,
      role: parsed.data.role,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[dev login]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Login failed" }, { status: 500 });
  }
}
