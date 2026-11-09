import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Users, Clock } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getDepartmentCards } from "@/lib/data/departments";
import { getMemberDirectory } from "@/lib/data/messages";
import { isAdmin } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { DeptIcon } from "@/components/shared/dept-icon";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { minutesLabel } from "@/lib/utils";
import { DepartmentDialog } from "@/components/departments/department-dialog";

export const metadata: Metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const profile = await requireProfile();
  const [departments, members] = await Promise.all([getDepartmentCards(), isAdmin(profile.role) ? getMemberDirectory() : Promise.resolve([])]);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Departments"
        description="Every team in the community, who leads it, and how active it has been this week."
        actions={isAdmin(profile.role) ? <DepartmentDialog members={members} /> : undefined}
      />

      {departments.length === 0 ? (
        <EmptyState icon={Building2} title="No departments yet" description="Admins can create Police, Fire, EMS, DOT and more." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {departments.map((d) => (
            <Link
              key={d.id}
              href={`/departments/${d.slug}`}
              className="group relative overflow-hidden rounded-xl border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-20 blur-2xl" style={{ background: d.color }} />
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `${d.color}26`, color: d.color }}>
                  <DeptIcon name={d.icon} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold group-hover:text-primary">{d.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{d.description ?? "No description yet."}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="size-3.5" /> {d.member_count} members</span>
                <span className="flex items-center gap-1"><Clock className="size-3.5" /> {minutesLabel(d.minutes_week)} this week</span>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs">
                {d.leader ? (
                  <>
                    <UserAvatar username={d.leader.roblox_username} avatarUrl={d.leader.avatar_url} className="size-5" />
                    <span className="text-muted-foreground">Led by</span>
                    <span className="font-medium">{d.leader.roblox_display_name ?? d.leader.roblox_username}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">No leader assigned</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
