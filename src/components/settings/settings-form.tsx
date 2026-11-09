"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clearErlcApiKey, testErlcKey, updateSettings } from "@/server/actions/settings";
import type { AppRole, ServerSettings } from "@/lib/types/database";

export function SettingsForm({ settings, hasEnvKey }: { settings: ServerSettings; hasEnvKey: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [communityName, setCommunityName] = useState(settings.community_name);
  const [apiKey, setApiKey] = useState("");
  const [groupId, setGroupId] = useState(settings.roblox_group_id ? String(settings.roblox_group_id) : "");
  const [requireGroup, setRequireGroup] = useState(settings.require_group_membership);
  const [quotaHours, setQuotaHours] = useState(String(settings.weekly_quota_minutes / 60));
  const [joinCodeRole, setJoinCodeRole] = useState<AppRole>(settings.join_code_visible_to);
  const [testing, setTesting] = useState(false);

  const save = () =>
    start(async () => {
      const r = await updateSettings({
        communityName,
        erlcApiKey: apiKey ? apiKey : undefined,
        robloxGroupId: groupId ? Number(groupId) : null,
        requireGroupMembership: requireGroup,
        weeklyQuotaMinutes: Math.round(Number(quotaHours || 0) * 60),
        joinCodeVisibleTo: joinCodeRole,
      });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Settings saved");
      setApiKey("");
      router.refresh();
    });

  const test = async () => {
    setTesting(true);
    const r = await testErlcKey(apiKey || undefined);
    setTesting(false);
    r.ok ? toast.success(`Connected to “${r.data!.name}” — ${r.data!.players} players online`) : toast.error(r.error);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Community</CardTitle><CardDescription>Shown in the sidebar and on the login page.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5"><Label>Community name</Label><Input value={communityName} onChange={(e) => setCommunityName(e.target.value)} /></div>
          <div className="grid gap-1.5">
            <Label>Weekly staff quota (hours, 0 = none)</Label>
            <Input type="number" min={0} step={0.5} value={quotaHours} onChange={(e) => setQuotaHours(e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Used by the dashboard, leaderboard and department pages for progress bars.</p>
          </div>
          <div className="grid gap-1.5">
            <Label>Who can see the join code</Label>
            <Select value={joinCodeRole} onValueChange={(v) => setJoinCodeRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Everyone</SelectItem>
                <SelectItem value="department_leader">Department leaders and above</SelectItem>
                <SelectItem value="staff">Staff and above</SelectItem>
                <SelectItem value="admin">Admins only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-4" /> ER:LC Private Server API</CardTitle><CardDescription>In-game: Server Settings → ER:LC API → copy the key. Requires the ER:LC API server pack.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label>API key {settings.erlc_api_key && <span className="font-normal text-muted-foreground">(current: {settings.erlc_api_key})</span>}</Label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={settings.erlc_api_key ? "Paste a new key to replace it" : hasEnvKey ? "Using ERLC_API_KEY from .env.local" : "Paste your server key"} autoComplete="off" />
            <p className="text-[11px] text-muted-foreground">The key is stored in the database and only ever used on the server. Anyone with it can run commands on your server — treat it like a password.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={test} disabled={testing || (!apiKey && !settings.erlc_api_key && !hasEnvKey)}>{testing ? <Loader2 className="size-3.5 animate-spin" /> : null} Test connection</Button>
            {settings.erlc_api_key && (
              <Button variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={() => confirm("Remove the stored ER:LC key?") && start(async () => { const r = await clearErlcApiKey(); if (r.ok) { toast.success("Key removed"); router.refresh(); } else toast.error(r.error); })}>
                <Trash2 className="size-3.5" /> Remove key
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Roblox verification</CardTitle><CardDescription>Roblox login already proves account ownership. Optionally also require membership of your Roblox group.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-1.5">
            <Label>Roblox group ID</Label>
            <Input value={groupId} onChange={(e) => setGroupId(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 12345678 (the number in your group URL)" />
          </div>
          <label className="flex items-center gap-3 rounded-md border px-4 text-sm">
            <Switch checked={requireGroup} onCheckedChange={setRequireGroup} disabled={!groupId} />
            Require group membership to sign in
          </label>
        </CardContent>
      </Card>

      <div className="flex justify-end lg:col-span-2">
        <Button onClick={save} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : null} Save settings</Button>
      </div>
    </div>
  );
}
