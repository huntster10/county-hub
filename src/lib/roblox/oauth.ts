import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Roblox OAuth 2.0 (OpenID Connect) helpers.
 * Docs: https://create.roblox.com/docs/cloud/auth/oauth2-reference
 *
 * Flow: /api/auth/roblox  → redirect user to Roblox
 *       Roblox            → redirect back to /api/auth/roblox/callback?code=...
 *       callback          → exchange code for tokens → fetch userinfo → sign in
 */

const ROBLOX_OAUTH = "https://apis.roblox.com/oauth/v1";

export const ROBLOX_REDIRECT_URI = `${env.appUrl}/api/auth/roblox/callback`;

function base64url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE: a random secret and its SHA-256 hash. The hash goes to Roblox first. */
export function createPkcePair() {
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function createState() {
  return base64url(randomBytes(24));
}

export function buildAuthorizeUrl(params: { state: string; codeChallenge: string }) {
  const url = new URL(`${ROBLOX_OAUTH}/authorize`);
  url.searchParams.set("client_id", env.robloxClientId);
  url.searchParams.set("redirect_uri", ROBLOX_REDIRECT_URI);
  url.searchParams.set("scope", "openid profile");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface RobloxTokens {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export async function exchangeCode(code: string, codeVerifier: string): Promise<RobloxTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    code_verifier: codeVerifier,
    client_id: env.robloxClientId,
    client_secret: env.robloxClientSecret,
  });
  const res = await fetch(`${ROBLOX_OAUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Roblox token exchange failed (${res.status}): ${await res.text()}`);
  return res.json();
}

export interface RobloxUserInfo {
  /** Roblox user id as a string — the stable identifier. */
  sub: string;
  /** Display name. */
  name?: string;
  nickname?: string;
  /** Username (the @handle). */
  preferred_username?: string;
  created_at?: number;
  profile?: string;
  picture?: string;
}

export async function fetchUserInfo(accessToken: string): Promise<RobloxUserInfo> {
  const res = await fetch(`${ROBLOX_OAUTH}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Roblox userinfo failed (${res.status})`);
  return res.json();
}

/** Optional extra verification: is this user in your Roblox group? */
export async function isInRobloxGroup(robloxId: string, groupId: number): Promise<boolean> {
  try {
    const res = await fetch(`https://groups.roblox.com/v2/users/${robloxId}/groups/roles`, { cache: "no-store" });
    if (!res.ok) return false;
    const json = (await res.json()) as { data?: { group: { id: number } }[] };
    return (json.data ?? []).some((g) => g.group.id === groupId);
  } catch {
    return false;
  }
}

/** Public Roblox API: headshot URL for a user id (no auth needed). */
export async function fetchHeadshotUrl(robloxId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { imageUrl?: string }[] };
    return json.data?.[0]?.imageUrl ?? null;
  } catch {
    return null;
  }
}
