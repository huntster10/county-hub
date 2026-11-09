import Link from "next/link";
import { Radio, ShieldCheck, MessageSquare, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { env, isRobloxOAuthConfigured } from "@/lib/env";
import { DevLoginForm } from "@/components/auth/dev-login-form";
import { RobloxLogo } from "@/components/auth/roblox-logo";

const ERRORS: Record<string, string> = {
  roblox_not_configured: "Roblox login isn't set up yet. Add ROBLOX_CLIENT_ID and ROBLOX_CLIENT_SECRET to .env.local.",
  missing_code: "Roblox didn't send a login code back. Please try again.",
  bad_state: "The login session expired or didn't match. Please try again.",
  not_in_group: "You must be a member of the community's Roblox group to sign in.",
  oauth_failed: "Something went wrong talking to Roblox. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] ?? "Login failed." : null;
  const next = typeof params.next === "string" ? params.next : "/dashboard";
  const robloxReady = isRobloxOAuthConfigured();

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Left: brand panel */}
      <section className="bg-grid relative hidden flex-col justify-between overflow-hidden border-r bg-sidebar p-10 lg:flex">
        <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-center gap-2 text-lg font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Radio className="size-4" />
          </span>
          County Hub
        </div>
        <div className="relative space-y-6">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Your community&apos;s
            <br />
            command center.
          </h1>
          <p className="max-w-md text-muted-foreground">
            Live server status, built-in chat, departments, shifts and moderation — all in one place, no Discord required.
          </p>
          <ul className="grid gap-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><MessageSquare className="size-4 text-primary" /> Real-time channels and DMs</li>
            <li className="flex items-center gap-2"><Users className="size-4 text-primary" /> Department rosters and leaderboards</li>
            <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Shifts, punishment logs and live players</li>
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">Not affiliated with Police Roleplay Community or Roblox.</p>
      </section>

      {/* Right: sign-in */}
      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Use your Roblox account. We only read your public username and user id.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <Button asChild size="lg" className="w-full" variant={robloxReady ? "default" : "secondary"}>
            <Link href={`/api/auth/roblox?next=${encodeURIComponent(next)}`}>
              <RobloxLogo className="size-4" />
              Continue with Roblox
            </Link>
          </Button>
          {!robloxReady && (
            <p className="text-center text-xs text-muted-foreground">
              Roblox login is not configured yet — see the README for how to register your app.
            </p>
          )}

          {env.devLoginEnabled && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                  <span className="bg-background px-2 text-muted-foreground">Developer login</span>
                </div>
              </div>
              <DevLoginForm next={next} />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
