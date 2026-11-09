import { NextResponse, type NextRequest } from "next/server";
import { buildAuthorizeUrl, createPkcePair, createState } from "@/lib/roblox/oauth";
import { isRobloxOAuthConfigured } from "@/lib/env";

/**
 * Step 1 of "Login with Roblox": send the user to Roblox's consent screen.
 * We remember the PKCE verifier + state in a short-lived httpOnly cookie so the
 * callback can prove the response really belongs to this browser.
 */
export function GET(request: NextRequest) {
  if (!isRobloxOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=roblox_not_configured", request.url));
  }

  const { verifier, challenge } = createPkcePair();
  const state = createState();
  const next = request.nextUrl.searchParams.get("next") ?? "/dashboard";

  const response = NextResponse.redirect(buildAuthorizeUrl({ state, codeChallenge: challenge }));
  response.cookies.set("rbx_oauth", JSON.stringify({ verifier, state, next }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
