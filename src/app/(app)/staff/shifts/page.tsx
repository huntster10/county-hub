import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { ShiftsTable, type ShiftRow } from "@/components/staff/shifts-table";
import { isAdmin } from "@/lib/permissions";

export const metadata: Metadata = { title: "Shifts" };

export default async function ShiftsPage({ searchParams }: PageProps<"/staff/shifts">) {
  const profile = await requireStaff();
  const params = await searchParams;
  const mine = params.mine === "1";
  const supabase = await createClient();

  let q = supabase
    .from("shifts")
    .select("*, profile:profiles!shifts_profile_id_fkey(id,roblox_username,roblox_display_name,avatar_url), department:departments(name,color), breaks:shift_breaks(id,started_at,ended_at)")
    .order("started_at", { ascending: false })
    .limit(200);
  if (mine) q = q.eq("profile_id", profile.id);
  const { data } = await q;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Shifts" description="Every clock-in, with breaks and totals. Active shifts update live on the dashboard." />
      <ShiftsTable rows={(data ?? []) as unknown as ShiftRow[]} mine={mine} canDelete={isAdmin(profile.role)} />
    </div>
  );
}
