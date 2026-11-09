import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { MemberDirectory, type DirectoryRow } from "@/components/members/member-directory";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const me = await requireProfile();
  const supabase = await createClient();
  const [{ data: profiles }, { data: memberships }, { data: departments }, { data: active }] = await Promise.all([
    supabase.from("profiles").select("id,roblox_username,roblox_display_name,avatar_url,role,bio,created_at,last_seen_at,verified_at").order("roblox_username"),
    supabase.from("department_members").select("profile_id,department_id,callsign, rank:department_ranks!department_members_rank_id_fkey(name)").neq("status", "suspended"),
    supabase.from("departments").select("id,name,color,slug").order("position"),
    supabase.from("shifts").select("profile_id").neq("status", "ended"),
  ]);

  type Membership = { profile_id: string; department_id: string; callsign: string | null; rank: { name: string } | null };
  const onDuty = new Set((active ?? []).map((s) => s.profile_id as string));
  const rows: DirectoryRow[] = ((profiles ?? []) as unknown as DirectoryRow[]).map((p) => ({
    ...p,
    departments: ((memberships ?? []) as unknown as Membership[])
      .filter((m) => m.profile_id === p.id)
      .map((m) => {
        const d = departments?.find((x) => x.id === m.department_id);
        return d ? { id: d.id, name: d.name, color: d.color, slug: d.slug, callsign: m.callsign, rank: m.rank?.name ?? null } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x)),
    on_duty: onDuty.has(p.id),
  }));

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Members" description={`${rows.length} people in the community.`} />
      <MemberDirectory rows={rows} departments={(departments ?? []) as { id: string; name: string; color: string; slug: string }[]} meId={me.id} />
    </div>
  );
}
