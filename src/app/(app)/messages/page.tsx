import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/empty-state";

/** /messages → jump straight into #general (or the first visible channel). */
export default async function MessagesIndex() {
  const supabase = await createClient();
  const { data } = await supabase.from("channels").select("id,slug").neq("type", "dm").order("position").limit(20);
  const general = data?.find((c) => c.slug === "general") ?? data?.[0];
  if (general) redirect(`/messages/${general.id}`);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <EmptyState icon={MessageSquare} title="No channels yet" description="An admin can create the first channel from the sidebar." />
    </div>
  );
}
