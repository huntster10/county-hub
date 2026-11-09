import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ErlcStatusProvider } from "@/lib/hooks/use-erlc-status";
import { EventFeed } from "@/components/staff/event-feed";
import type { GameEvent } from "@/lib/types/database";

export const metadata: Metadata = { title: "Event Feed" };

export default async function EventsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("game_events").select("*").order("occurred_at", { ascending: false }).limit(300);

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Game event feed" description="Live joins, leaves, kills, commands and mod calls. History is kept so you can scroll back." />
      <ErlcStatusProvider intervalMs={10_000}>
        <EventFeed history={(data ?? []) as GameEvent[]} />
      </ErlcStatusProvider>
    </div>
  );
}
