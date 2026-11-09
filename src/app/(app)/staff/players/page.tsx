import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { LivePlayers } from "@/components/staff/live-players";
import { ErlcStatusProvider } from "@/lib/hooks/use-erlc-status";

export const metadata: Metadata = { title: "Live Players" };

export default async function PlayersPage({ searchParams }: PageProps<"/staff/players">) {
  await requireStaff();
  const params = await searchParams;
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Live players" description="Who is in the server right now, straight from the ER:LC API. Refreshes every 10 seconds." />
      <ErlcStatusProvider intervalMs={10_000}>
        <LivePlayers focusCommand={params.command === "1"} />
      </ErlcStatusProvider>
    </div>
  );
}
