import { CheckCircle2, Circle, Radio } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { env, isRobloxOAuthConfigured, isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/env";

/**
 * Shown automatically until Supabase is configured. A plain-English checklist
 * so a first-time user is never stuck looking at an error screen.
 */
export default function SetupPage() {
  const steps = [
    {
      done: isSupabaseConfigured(),
      title: "Connect Supabase (database + login)",
      detail:
        "Create a free project at supabase.com, open Project Settings → API, and copy the Project URL and anon/publishable key into .env.local as NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    },
    {
      done: isServiceRoleConfigured(),
      title: "Add the service role key",
      detail:
        "On the same API page copy the service_role (secret) key into .env.local as SUPABASE_SERVICE_ROLE_KEY. The server uses it to create accounts after Roblox login. Never share it.",
    },
    {
      done: isSupabaseConfigured(),
      title: "Run the database migration",
      detail:
        "In Supabase open SQL Editor → New query, paste the contents of supabase/migrations/0001_init.sql and click Run. This creates every table, permission rule and starter channel.",
    },
    {
      done: isRobloxOAuthConfigured() || env.devLoginEnabled,
      title: "Choose a login method",
      detail:
        "For local testing set DEV_LOGIN_ENABLED=true. For real users register an OAuth app at create.roblox.com/dashboard/credentials and add ROBLOX_CLIENT_ID / ROBLOX_CLIENT_SECRET.",
    },
    {
      done: Boolean(env.erlcApiKey),
      title: "(Optional) Add your ER:LC API key",
      detail:
        "In-game: Server Settings → ER:LC API → copy the key. Paste it in Settings inside the app once you're logged in, or set ERLC_API_KEY in .env.local.",
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-6">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Radio className="size-4" />
        </span>
        County Hub — first-time setup
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Almost there</CardTitle>
          <CardDescription>
            Complete the steps below, then restart the dev server (<code>npm run dev</code>) and refresh this page.
            Full details are in README.md.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-3">
              {s.done ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Check <code>/api/health</code> to see which settings the server can read.
      </p>
    </main>
  );
}
