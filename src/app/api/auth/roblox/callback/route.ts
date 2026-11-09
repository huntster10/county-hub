import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, fetchHeadshotUrl, fetchUserInfo, isInRobloxGroup } from "@/lib/roblox/oauth";
import { signInAsRoblox } from "@/lib/auth/create-session";
import { getServerSettings } from "@/lib/settings";

/**
 * Step 2 of "Login with Roblox": Roblox sends the user back here with a code.
 * We trade the code for tokens, read the user's Roblox identity, run any extra
 * verification (group membership), then create the website session.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.cookies.get("rbx_oauth")?.value;

  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
    res.cookies.delete("rbx_oauth");
    return res;
  };

  if (!code || !state || !cookie) return fail("missing_code");

  let saved: { verifier: string; state: string; next: string };
  try {
    saved = JSON.parse(cookie);
  } catch {
    return fail("bad_state");
  }
  if (saved.state !== state) return fail("bad_state");

  try {
    const tokens = await exchangeCode(code, saved.verifier);
    const info = await fetchUserInfo(tokens.access_token);

    // Optional verification: group membership.
    const settings = await getServerSettings();
    if (settings.require_group_membership && settings.roblox_group_id) {
      const ok = await isInRobloxGroup(info.sub, Number(settings.roblox_group_id));
      if (!ok) return fail("not_in_group");
    }

    const avatar = info.picture ?? (await fetchHeadshotUrl(info.sub));

    await signInAsRoblox({
      robloxId: info.sub,
      username: info.preferred_username ?? info.nickname ?? `user${info.sub}`,
      displayName: info.name ?? info.nickname ?? null,
      avatarUrl: avatar,
      verified: true, // OAuth proves ownership of the Roblox account
    });

    const res = NextResponse.redirect(new URL(saved.next || "/dashboard", request.url));
    res.cookies.delete("rbx_oauth");
    return res;
  } catch (err) {
    console.error("[roblox oauth]", err);
    return fail("oauth_failed");
  }
}
