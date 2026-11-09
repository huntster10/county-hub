"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { isAdmin, isStaff } from "@/lib/permissions";
import { slugify } from "@/lib/utils";
import type { Attachment, Embed, Message } from "@/lib/types/database";
import type { ActionResult } from "./shifts";

const MENTION_RE = /@([A-Za-z0-9_]{3,20})/g;

/**
 * Turns "@Username" tokens in a message into profile ids so we can store them
 * in `mentions` and highlight them for the people mentioned.
 */
async function resolveMentions(content: string): Promise<string[]> {
  const names = [...content.matchAll(MENTION_RE)].map((m) => m[1]);
  if (names.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id").in("roblox_username", names);
  return (data ?? []).map((r) => r.id as string);
}

/** Detects the first http(s) link and makes a tiny "embed" card for it. */
function buildEmbeds(content: string): Embed[] {
  const match = content.match(/https?:\/\/[^\s)]+/);
  if (!match) return [];
  try {
    const url = new URL(match[0]);
    const isImage = /\.(png|jpe?g|gif|webp)$/i.test(url.pathname);
    return [{ url: url.toString(), title: url.hostname, ...(isImage ? { image: url.toString() } : {}) }];
  } catch {
    return [];
  }
}

const sendSchema = z.object({
  channelId: z.string().uuid(),
  content: z.string().max(4000),
  attachments: z
    .array(z.object({ url: z.string().url(), name: z.string(), size: z.number(), type: z.string() }))
    .max(5)
    .default([]),
  replyToId: z.string().uuid().nullable().optional(),
});

export async function sendMessage(input: z.infer<typeof sendSchema>): Promise<ActionResult<Message>> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid message" };
  const { channelId, content, attachments, replyToId } = parsed.data;
  if (!content.trim() && attachments.length === 0) return { ok: false, error: "Message is empty" };

  const supabase = await createClient();
  const mentions = await resolveMentions(content);
  const { data, error } = await supabase
    .from("messages")
    .insert({
      channel_id: channelId,
      author_id: profile.id,
      content: content.trim(),
      attachments: attachments as Attachment[],
      embeds: buildEmbeds(content),
      mentions,
      reply_to_id: replyToId ?? null,
    })
    .select("*")
    .single();
  if (error) {
    const friendly = error.message.includes("row-level security")
      ? "You can't post in this channel."
      : error.message;
    return { ok: false, error: friendly };
  }

  // Sending a message also marks the channel as read for the sender.
  await supabase.from("channel_read_states").upsert({ channel_id: channelId, profile_id: profile.id, last_read_at: new Date().toISOString() });
  return { ok: true, data: data as Message };
}

export async function editMessage(id: string, content: string): Promise<ActionResult> {
  const supabase = await createClient();
  const mentions = await resolveMentions(content);
  const { error } = await supabase
    .from("messages")
    .update({ content: content.trim().slice(0, 4000), mentions, embeds: buildEmbeds(content), edited_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Soft delete so replies still have something to point at. */
export async function deleteMessage(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString(), content: "", attachments: [], embeds: [] })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function togglePin(id: string, pinned: boolean): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isStaff(profile.role)) return { ok: false, error: "Only staff can pin messages" };
  const supabase = await createClient();
  const { error } = await supabase.from("messages").update({ pinned }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function toggleReaction(messageId: string, emoji: string): Promise<ActionResult<"added" | "removed">> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("message_id")
    .match({ message_id: messageId, profile_id: profile.id, emoji })
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from("message_reactions").delete().match({ message_id: messageId, profile_id: profile.id, emoji });
    return error ? { ok: false, error: error.message } : { ok: true, data: "removed" };
  }
  const { error } = await supabase.from("message_reactions").insert({ message_id: messageId, profile_id: profile.id, emoji });
  return error ? { ok: false, error: error.message } : { ok: true, data: "added" };
}

export async function markChannelRead(channelId: string): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const supabase = await createClient();
  await supabase.from("channel_read_states").upsert({ channel_id: channelId, profile_id: profile.id, last_read_at: new Date().toISOString() });
}

export async function searchMessages(query: string, channelId?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("messages")
    .select("id,channel_id,content,created_at, author:profiles!messages_author_id_fkey(roblox_username,avatar_url), channel:channels!messages_channel_id_fkey(name)")
    .is("deleted_at", null)
    .textSearch("search", query.trim().split(/\s+/).join(" & "), { type: "plain" })
    .order("created_at", { ascending: false })
    .limit(30);
  if (channelId) q = q.eq("channel_id", channelId);
  const { data } = await q;
  return data ?? [];
}

/** Open (or create) a direct-message channel with another member. */
export async function startDm(otherProfileId: string): Promise<ActionResult<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_or_create_dm", { other: otherProfileId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/messages");
  return { ok: true, data: data as string };
}

const channelSchema = z.object({
  name: z.string().min(2).max(40),
  topic: z.string().max(200).optional().nullable(),
  type: z.enum(["text", "announcement"]).default("text"),
  categoryId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  minRole: z.enum(["owner", "admin", "staff", "department_leader", "member"]).nullable().optional(),
  isPrivate: z.boolean().default(false),
});

export async function createChannel(input: z.infer<typeof channelSchema>): Promise<ActionResult<string>> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in" };
  const parsed = channelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid channel" };
  const v = parsed.data;
  const supabase = await createClient();
  const slug = slugify(v.name) + (v.departmentId ? `-${v.departmentId.slice(0, 4)}` : "");
  const { data, error } = await supabase
    .from("channels")
    .insert({
      name: slugify(v.name),
      slug,
      topic: v.topic ?? null,
      type: v.type,
      category_id: v.categoryId ?? null,
      department_id: v.departmentId ?? null,
      min_role: v.minRole === "member" ? null : (v.minRole ?? null),
      is_private: v.isPrivate,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message.includes("duplicate") ? "A channel with that name already exists." : error.message };
  // Creator is always a member of a private channel they created.
  if (v.isPrivate) await supabase.from("channel_members").insert({ channel_id: data.id, profile_id: profile.id });
  revalidatePath("/messages");
  return { ok: true, data: data.id as string };
}

export async function updateChannel(
  id: string,
  input: Partial<Pick<z.infer<typeof channelSchema>, "name" | "topic" | "type" | "minRole" | "isPrivate" | "categoryId">>,
): Promise<ActionResult> {
  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = slugify(input.name);
  if (input.topic !== undefined) patch.topic = input.topic;
  if (input.type !== undefined) patch.type = input.type;
  if (input.minRole !== undefined) patch.min_role = input.minRole === "member" ? null : input.minRole;
  if (input.isPrivate !== undefined) patch.is_private = input.isPrivate;
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  const { error } = await supabase.from("channels").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/messages");
  return { ok: true };
}

export async function deleteChannel(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !isAdmin(profile.role)) return { ok: false, error: "Admins only" };
  const supabase = await createClient();
  const { error } = await supabase.from("channels").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/messages");
  return { ok: true };
}

export async function createCategory(name: string, departmentId?: string | null): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("channel_categories").insert({ name: name.trim().slice(0, 40), department_id: departmentId ?? null, position: 50 });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/messages");
  return { ok: true };
}

/** Add / remove people from a private channel (admins). */
export async function setChannelMember(channelId: string, profileId: string, member: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = member
    ? await supabase.from("channel_members").insert({ channel_id: channelId, profile_id: profileId })
    : await supabase.from("channel_members").delete().match({ channel_id: channelId, profile_id: profileId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/messages");
  return { ok: true };
}
