import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getChannelMessages, getMemberDirectory, getPinnedMessages } from "@/lib/data/messages";
import { markChannelRead } from "@/server/actions/messages";
import { ChatRoom } from "@/components/chat/chat-room";
import type { Channel } from "@/lib/types/database";

export default async function ChannelPage({ params }: PageProps<"/messages/[channelId]">) {
  const { channelId } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: channel } = await supabase.from("channels").select("*").eq("id", channelId).maybeSingle();
  if (!channel) notFound();

  const [messages, pinned, members, dmOther] = await Promise.all([
    getChannelMessages(channelId),
    getPinnedMessages(channelId),
    getMemberDirectory(),
    channel.type === "dm"
      ? supabase
          .from("channel_members")
          .select("profile:profiles!channel_members_profile_id_fkey(id,roblox_username,roblox_display_name,avatar_url)")
          .eq("channel_id", channelId)
          .neq("profile_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Opening a channel clears its unread badge.
  await markChannelRead(channelId);

  const other = (dmOther.data as { profile: { id: string; roblox_username: string; roblox_display_name: string | null; avatar_url: string | null } } | null)?.profile ?? null;

  return (
    <ChatRoom
      key={channelId}
      channel={channel as Channel}
      dmPartner={other}
      initialMessages={messages}
      initialPinned={pinned}
      members={members}
      me={profile}
    />
  );
}
