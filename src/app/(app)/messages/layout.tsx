import { requireProfile } from "@/lib/auth/session";
import { getChannelTree, getMemberDirectory } from "@/lib/data/messages";
import { createClient } from "@/lib/supabase/server";
import { ChannelSidebar } from "@/components/chat/channel-sidebar";
import type { Department } from "@/lib/types/database";

/**
 * Two-pane chat layout: channel list on the left, the conversation on the right.
 * Fills the viewport below the top bar so the message list scrolls on its own.
 */
export default async function MessagesLayout({ children }: LayoutProps<"/messages">) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [tree, members, deptRes] = await Promise.all([
    getChannelTree(profile),
    getMemberDirectory(),
    supabase.from("departments").select("id,name,color").order("position"),
  ]);

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      <ChannelSidebar
        tree={tree}
        profile={profile}
        members={members}
        departments={(deptRes.data ?? []) as Pick<Department, "id" | "name" | "color">[]}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
