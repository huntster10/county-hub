import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { CadBoard, type CallRow } from "@/components/cad/cad-board";
import type { Department, Profile } from "@/lib/types/database";

export const metadata: Metadata = { title: "CAD / Dispatch" };

export default async function CadPage({ searchParams }: PageProps<"/cad">) {
  const me = await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: calls }, { data: departments }, { data: profiles }] = await Promise.all([
    supabase.from("cad_calls").select("*, department:departments(name,color), creator:profiles!cad_calls_created_by_fkey(roblox_username)").order("priority").order("created_at", { ascending: false }).limit(100),
    supabase.from("departments").select("id,name,color").order("position"),
    supabase.from("profiles").select("id,roblox_username,avatar_url"),
  ]);
  return (
    <div className="p-4 md:p-6">
      <PageHeader title="CAD / Dispatch" description="Live call board. Anyone can report a call; responders attach themselves and update the status." />
      <CadBoard
        calls={(calls ?? []) as unknown as CallRow[]}
        departments={(departments ?? []) as Pick<Department, "id" | "name" | "color">[]}
        profiles={(profiles ?? []) as Pick<Profile, "id" | "roblox_username" | "avatar_url">[]}
        me={me}
        canManage={isStaff(me.role)}
        openNew={params.new === "1"}
      />
    </div>
  );
}
