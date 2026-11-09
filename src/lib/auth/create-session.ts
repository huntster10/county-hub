import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/types/database";

export interface RobloxIdentity {
  robloxId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  /** True when the identity came from real Roblox OAuth (not the dev login). */
  verified: boolean;
  isDevAccount?: boolean;
  /** Only used by the dev login to pick a role for testing. */
  role?: AppRole;
}

/**
 * Every account gets a synthetic email so Supabase Auth can manage sessions.
 * Nobody ever receives mail at this address — it's just a stable unique key.
 */
export function syntheticEmail(robloxId: string, isDev = false) {
  return `${isDev ? "dev" : "roblox"}-${robloxId}@erlchub.invalid`;
}

/**
 * Signs the visitor in as the given Roblox identity.
 *
 * How it works (this is the trick that lets us use Roblox with Supabase Auth,
 * which has no built-in Roblox provider):
 *   1. Using the service role, find or create an auth user keyed by the Roblox id.
 *   2. Ask Supabase for a one-time magic-link token for that user.
 *   3. Immediately redeem the token on the server, which sets the session cookies.
 * The user never sees any of this — they just land on the dashboard logged in.
 */
export async function signInAsRoblox(identity: RobloxIdentity) {
  const admin = createAdminClient();
  const email = syntheticEmail(identity.robloxId, identity.isDevAccount);

  const metadata = {
    roblox_id: identity.robloxId,
    roblox_username: identity.username,
    roblox_display_name: identity.displayName,
    avatar_url: identity.avatarUrl,
    verified: identity.verified ? "true" : "false",
    is_dev_account: identity.isDevAccount ?? false,
    ...(identity.role ? { role: identity.role } : {}),
  };

  // 1. Find an existing profile for this Roblox account.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq(identity.isDevAccount ? "roblox_username" : "roblox_id", identity.isDevAccount ? identity.username : Number(identity.robloxId))
    .maybeSingle();

  let userId: string;
  if (existing?.id) {
    userId = existing.id as string;
    await admin.auth.admin.updateUserById(userId, { user_metadata: metadata });
    // Keep the displayed names fresh in case they changed on Roblox.
    await admin
      .from("profiles")
      .update({
        roblox_username: identity.username,
        roblox_display_name: identity.displayName,
        avatar_url: identity.avatarUrl ?? undefined,
        last_seen_at: new Date().toISOString(),
        ...(identity.verified ? { verified_at: new Date().toISOString() } : {}),
      })
      .eq("id", userId);
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");
    userId = created.user.id;
  }

  // 2. Mint a one-time token...
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkError || !link.properties?.hashed_token) {
    throw new Error(linkError?.message ?? "Could not generate login token");
  }

  // 3. ...and redeem it right away, which writes the session cookies.
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (verifyError) throw new Error(verifyError.message);

  return userId;
}
