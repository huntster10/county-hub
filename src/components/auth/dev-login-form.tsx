"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Local-only login form. Type any username to create a test account.
 * The first account ever created becomes the Owner automatically.
 */
export function DevLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, role }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Login failed");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-dashed p-4">
      <div className="space-y-1.5">
        <Label htmlFor="dev-username">Test username</Label>
        <Input
          id="dev-username"
          placeholder="e.g. TestOfficer"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label>Role (ignored for the very first account — it becomes Owner)</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="member">Member</SelectItem>
            <SelectItem value="department_leader">Department Leader</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" className="w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in as test user"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Only visible because DEV_LOGIN_ENABLED=true. Turn it off before inviting your community.
      </p>
    </form>
  );
}
