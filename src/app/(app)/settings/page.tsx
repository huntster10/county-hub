import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getServerSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { env, isRobloxOAuthConfigured, isServiceRoleConfigured } from "@/lib/env";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsForm } from "@/components/settings/settings-form";
import { RolesManager } from "@/components/settings/roles-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";
import type { Profile } from "@/lib/types/database";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireRole("admin");
  const settings = await getServerSettings();
  const supabase = await createClient();
  const { data: members } = await supabase.from("profiles").select("id,roblox_username,roblox_display_name,avatar_url,role,verified_at,is_dev_account,created_at").order("roblox_username");
  const { data: audit } = await supabase.from("audit_log").select("*, actor:profiles!audit_log_actor_id_fkey(roblox_username)").order("created_at", { ascending: false }).limit(50);

  const checks = [
    { ok: isServiceRoleConfigured(), label: "Supabase service role key", hint: "Needed to create accounts after login." },
    { ok: isRobloxOAuthConfigured(), label: "Roblox OAuth app", hint: isRobloxOAuthConfigured() ? "Members can sign in with Roblox." : "Add ROBLOX_CLIENT_ID / SECRET to .env.local." },
    { ok: Boolean(settings.erlc_api_key || env.erlcApiKey), label: "ER:LC API key", hint: settings.erlc_api_key ? "Stored in Settings." : env.erlcApiKey ? "Using ERLC_API_KEY from .env.local." : "Add it in the Server tab." },
    { ok: !env.devLoginEnabled, label: "Developer login disabled", hint: env.devLoginEnabled ? "DEV_LOGIN_ENABLED=true — turn off before going public!" : "Good — only Roblox login is available." },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Server settings" description="Community-wide configuration. Only admins and the owner can see this page." />
      <Tabs defaultValue="server">
        <TabsList>
          <TabsTrigger value="server">Server & ER:LC</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="server">
          <SettingsForm settings={{ ...settings, erlc_api_key: settings.erlc_api_key ? "••••••••" + settings.erlc_api_key.slice(-4) : null }} hasEnvKey={Boolean(env.erlcApiKey)} />
        </TabsContent>

        <TabsContent value="roles">
          <RolesManager members={(members ?? []) as Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role" | "verified_at" | "is_dev_account" | "created_at">[]} me={me} />
        </TabsContent>

        <TabsContent value="health">
          <Card>
            <CardHeader><CardTitle>Configuration checklist</CardTitle><CardDescription>Environment variables are read from .env.local on the server.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {checks.map((c) => (
                <div key={c.label} className="flex items-start gap-3">
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : <XCircle className="mt-0.5 size-4 text-warning" />}
                  <div><p className="text-sm font-medium">{c.label}</p><p className="text-xs text-muted-foreground">{c.hint}</p></div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardContent className="p-0">
              {!audit?.length ? <p className="p-6 text-center text-sm text-muted-foreground">No audit entries yet. Commands and settings changes are recorded here.</p> : (
                <ul className="divide-y divide-border/60">
                  {(audit as unknown as { id: number; action: string; target: string | null; created_at: string; actor: { roblox_username: string } | null }[]).map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{a.action}</code>
                      <span className="flex-1 truncate text-muted-foreground">{a.target}</span>
                      <span className="text-xs">{a.actor?.roblox_username ?? "system"}</span>
                      <span className="text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
