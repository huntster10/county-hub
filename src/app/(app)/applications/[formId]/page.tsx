import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isAdmin, isStaff } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { ApplicationForm as ApplyForm } from "@/components/applications/apply-form";
import { ReviewQueue, type ReviewRow } from "@/components/applications/review-queue";
import { FormBuilderDialog } from "@/components/applications/form-builder";
import type { Application, ApplicationForm, Department } from "@/lib/types/database";

export default async function FormPage({ params }: PageProps<"/applications/[formId]">) {
  const { formId } = await params;
  const me = await requireProfile();
  const supabase = await createClient();
  const { data: form } = await supabase.from("application_forms").select("*, department:departments(id,name,color,leader_id)").eq("id", formId).maybeSingle();
  if (!form) notFound();
  const f = form as unknown as ApplicationForm & { department: { id: string; name: string; color: string; leader_id: string | null } | null };

  const isReviewer = isStaff(me.role) || (f.department?.leader_id === me.id);
  const [{ data: mine }, { data: all }, { data: departments }] = await Promise.all([
    supabase.from("applications").select("*").eq("form_id", formId).eq("applicant_id", me.id).order("created_at", { ascending: false }),
    isReviewer
      ? supabase.from("applications").select("*, applicant:profiles!applications_applicant_id_fkey(id,roblox_username,roblox_display_name,avatar_url), reviewer:profiles!applications_reviewer_id_fkey(roblox_username)").eq("form_id", formId).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("departments").select("id,name,color,leader_id").order("position"),
  ]);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <PageHeader
        title={f.title}
        description={f.description ?? undefined}
        actions={(isAdmin(me.role) || f.department?.leader_id === me.id) ? <FormBuilderDialog departments={(departments ?? []) as Pick<Department, "id" | "name" | "color" | "leader_id">[]} isAdmin={isAdmin(me.role)} meId={me.id} existing={f} /> : undefined}
      />
      <div className="grid gap-6">
        <ApplyForm form={f} myApplications={(mine ?? []) as Application[]} />
        {isReviewer && <ReviewQueue rows={(all ?? []) as unknown as ReviewRow[]} questions={f.questions} />}
      </div>
    </div>
  );
}
