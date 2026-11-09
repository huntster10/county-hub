import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Channel, ChannelCategory, MessageWithAuthor, Profile } from "@/lib/types/database";

export type ChannelLite = Pick<Channel, "id" | "name" | "slug" | "type" | "topic" | "is_private" | "min_role" | "category_id" | "department_id" | "position">;

export interface DmEntry {
  channel: ChannelLite;
  other: Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role"> | null;
}

export interface ChannelTree {
  categories: (Pick<ChannelCategory, "id" | "name" | "position" | "department_id"> & { channels: ChannelLite[] })[];
  uncategorised: ChannelLite[];
  dms: DmEntry[];
  unread: Record<string, number>;
}

export async function getChannelTree(profile: Profile): Promise<ChannelTree> {
  const supabase = await createClient();
  const [catRes, chanRes, unreadRes, dmMembersRes] = await Promise.all([
    supabase.from("channel_categories").select("id,name,position,department_id").order("position"),
    supabase.from("channels").select("id,name,slug,type,topic,is_private,min_role,category_id,department_id,position").order("position"),
    supabase.rpc("unread_counts"),
    supabase
      .from("channel_members")
      .select("channel_id, profile:profiles!channel_members_profile_id_fkey(id,roblox_username,roblox_display_name,avatar_url,role)")
      .neq("profile_id", profile.id),
  ]);

  const channels = (chanRes.data ?? []) as ChannelLite[];
  const categories = ((catRes.data ?? []) as ChannelTree["categories"]).map((c) => ({
    ...c,
    channels: channels.filter((ch) => ch.category_id === c.id && ch.type !== "dm"),
  })).filter((c) => c.channels.length > 0);

  const uncategorised = channels.filter((ch) => !ch.category_id && ch.type !== "dm");

  type DmMember = { channel_id: string; profile: DmEntry["other"] };
  const dmMembers = (dmMembersRes.data ?? []) as unknown as DmMember[];
  const dms: DmEntry[] = channels
    .filter((ch) => ch.type === "dm")
    .map((ch) => ({ channel: ch, other: dmMembers.find((m) => m.channel_id === ch.id)?.profile ?? null }));

  const unread: Record<string, number> = {};
  for (const r of (unreadRes.data ?? []) as { channel_id: string; unread: number }[]) unread[r.channel_id] = r.unread;

  return { categories, uncategorised, dms, unread };
}

export const MESSAGE_SELECT =
  "*, author:profiles!messages_author_id_fkey(id,roblox_username,roblox_display_name,avatar_url,role), reactions:message_reactions(message_id,profile_id,emoji,created_at)";

export async function getChannelMessages(channelId: string, limit = 50): Promise<MessageWithAuthor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as unknown as MessageWithAuthor[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function getPinnedMessages(channelId: string): Promise<MessageWithAuthor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("channel_id", channelId)
    .eq("pinned", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as unknown as MessageWithAuthor[];
}

/** Everyone, for @mention autocomplete and DM picker. */
export async function getMemberDirectory() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,roblox_username,roblox_display_name,avatar_url,role")
    .order("roblox_username");
  return (data ?? []) as Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role">[];
}
