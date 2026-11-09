import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { PunishmentsPanel, type PunishmentRow } from "@/components/staff/punishments-panel";

export const metadata: Metadata = { title: "Punishments" };

export default async function PunishmentsPage({ searchParams }: PageProps<"/staff/punishments">) {
  const profile = await requireStaff();
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("punishments")
    .select("*, moderator:profiles!punishments_moderator_id_fkey(id,roblox_username,avatar_url)")
    .order("created_at", { ascending: false })
    .limit(300);

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Punishment logs" description="Warnings, kicks, bans, notes and BOLOs. Search any player to see their full history." />
      <PunishmentsPanel
        rows={(data ?? []) as unknown as PunishmentRow[]}
        openNew={params.new === "1"}
        prefillUser={typeof params.user === "string" ? params.user : undefined}
        canDelete={isAdmin(profile.role)}
      />
    </div>
  );
}
