import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { SessionsBoard, type SessionRow, type PollRow } from "@/components/sessions/sessions-board";

export const metadata: Metadata = { title: "Sessions" };

export default async function SessionsPage() {
  const me = await requireProfile();
  const supabase = await createClient();
  const [{ data: sessions }, { data: polls }, { data: votes }] = await Promise.all([
    supabase.from("sessions").select("*, host:profiles!sessions_host_id_fkey(roblox_username,avatar_url)").order("created_at", { ascending: false }).limit(50),
    supabase.from("polls").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("poll_votes").select("poll_id,profile_id,option_index"),
  ]);
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Sessions" description="Schedule roleplay sessions, start and stop them, and run quick polls." />
      <SessionsBoard
        sessions={(sessions ?? []) as unknown as SessionRow[]}
        polls={(polls ?? []) as PollRow[]}
        votes={(votes ?? []) as { poll_id: string; profile_id: string; option_index: number }[]}
        canManage={isStaff(me.role)}
        meId={me.id}
      />
    </div>
  );
}
