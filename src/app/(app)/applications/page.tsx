import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, ChevronRight } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, isStaff } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FormBuilderDialog } from "@/components/applications/form-builder";
import type { Application, ApplicationForm, Department } from "@/lib/types/database";

export const metadata: Metadata = { title: "Applications" };

export default async function ApplicationsPage() {
  const me = await requireProfile();
  const supabase = await createClient();
  const [{ data: forms }, { data: mine }, { data: pendingCounts }, { data: departments }] = await Promise.all([
    supabase.from("application_forms").select("*, department:departments(name,color)").order("created_at", { ascending: false }),
    supabase.from("applications").select("form_id,status").eq("applicant_id", me.id),
    isStaff(me.role) || me.role === "department_leader" ? supabase.from("applications").select("form_id").eq("status", "pending") : Promise.resolve({ data: [] }),
    supabase.from("departments").select("id,name,color,leader_id").order("position"),
  ]);

  const myApps = (mine ?? []) as Pick<Application, "form_id" | "status">[];
  const pending = (pendingCounts ?? []) as { form_id: string }[];
  const canCreate = isAdmin(me.role) || (departments ?? []).some((d) => d.leader_id === me.id);

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Applications"
        description="Apply to join staff or a department. Reviewers see submissions on each form's page."
        actions={canCreate ? <FormBuilderDialog departments={(departments ?? []) as Pick<Department, "id" | "name" | "color" | "leader_id">[]} isAdmin={isAdmin(me.role)} meId={me.id} /> : undefined}
      />
      {!forms?.length ? (
        <EmptyState icon={ClipboardList} title="No application forms yet" description="Admins and department leaders can create one." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {(forms as unknown as (ApplicationForm & { department: { name: string; color: string } | null })[]).map((f) => {
            const my = myApps.find((a) => a.form_id === f.id);
            const pend = pending.filter((p) => p.form_id === f.id).length;
            return (
              <Link key={f.id} href={`/applications/${f.id}`} className="group flex items-center gap-4 rounded-xl border bg-card p-5 transition-colors hover:border-primary/40">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold group-hover:text-primary">{f.title}</p>
                    {!f.is_open && <Badge variant="secondary">Closed</Badge>}
                    {f.department && <Badge variant="outline" style={{ color: f.department.color }}>{f.department.name}</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{f.description ?? `${f.questions.length} questions`}</p>
                  <div className="mt-2 flex gap-2 text-[11px]">
                    {my && <Badge variant={my.status === "accepted" ? "success" : my.status === "denied" ? "destructive" : "warning"}>Your application: {my.status}</Badge>}
                    {pend > 0 && <Badge>{pend} to review</Badge>}
                  </div>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
