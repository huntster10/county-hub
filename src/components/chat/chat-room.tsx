"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, isSameDay } from "date-fns";
import { Hash, Lock, Megaphone, Pin, Search, Settings2, ArrowDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { isAdmin, isStaff } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { MessageItem, formatMessageTime } from "./message-item";
import { MessageComposer } from "./message-composer";
import { EditChannelDialog } from "./channel-dialogs";
import {
  deleteMessage,
  editMessage,
  markChannelRead,
  searchMessages,
  sendMessage,
  togglePin,
  toggleReaction,
} from "@/server/actions/messages";
import type { Attachment, Channel, Message, MessageReaction, MessageWithAuthor, Profile } from "@/lib/types/database";

type MemberLite = Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role">;

/**
 * The conversation pane. Receives the first page of messages from the server,
 * then keeps itself in sync with Supabase Realtime: inserts, edits, deletes
 * and reactions arrive live for everyone looking at the channel.
 */
export function ChatRoom({
  channel,
  dmPartner,
  initialMessages,
  initialPinned,
  members,
  me,
}: {
  channel: Channel;
  dmPartner: { id: string; roblox_username: string; roblox_display_name: string | null; avatar_url: string | null } | null;
  initialMessages: MessageWithAuthor[];
  initialPinned: MessageWithAuthor[];
  members: MemberLite[];
  me: Profile;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<MessageWithAuthor[]>(initialMessages);
  const [replyTo, setReplyTo] = useState<MessageWithAuthor | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<Awaited<ReturnType<typeof searchMessages>>>([]);
  const [searching, startSearch] = useTransition();
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const pinned = messages.filter((m) => m.pinned && !m.deleted_at);
  const isAnnouncement = channel.type === "announcement";
  const canPost = !isAnnouncement || isStaff(me.role);

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
    setNewCount(0);
  }, []);

  // Scroll to the newest message when the channel opens.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [channel.id]);

  // Track whether the user is reading history (don't yank them to the bottom).
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAtBottom(near);
    if (near) setNewCount(0);
  };

  // ---- Realtime -----------------------------------------------------------
  useEffect(() => {
    const supabase = createClient();
    const room = supabase
      .channel(`room:${channel.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channel.id}` },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            const author = row.author_id ? (memberMap.get(row.author_id) ?? null) : null;
            return [...prev, { ...row, author, reactions: [] }];
          });
          if (row.author_id !== me.id) {
            if (atBottom) {
              requestAnimationFrame(() => scrollToBottom());
              void markChannelRead(channel.id);
            } else {
              setNewCount((n) => n + 1);
            }
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${channel.id}` },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === row.id ? { ...m, ...row } : m)));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `channel_id=eq.${channel.id}` },
        (payload) => {
          const row = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== row.id));
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as MessageReaction;
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== row.message_id) return m;
            const existing = (m.reactions ?? []).filter((r) => !(r.profile_id === row.profile_id && r.emoji === row.emoji));
            return { ...m, reactions: payload.eventType === "DELETE" ? existing : [...existing, row] };
          }),
        );
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(room);
    };
  }, [channel.id, me.id, memberMap, atBottom, scrollToBottom]);

  // ---- Actions ------------------------------------------------------------
  const handleSend = async (content: string, attachments: Attachment[]) => {
    const r = await sendMessage({ channelId: channel.id, content, attachments, replyToId: replyTo?.id ?? null });
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    // Show our own message instantly (realtime will de-dupe when it echoes back).
    const author = memberMap.get(me.id) ?? { id: me.id, roblox_username: me.roblox_username, roblox_display_name: me.roblox_display_name, avatar_url: me.avatar_url, role: me.role };
    setMessages((prev) => (prev.some((m) => m.id === r.data!.id) ? prev : [...prev, { ...r.data!, author, reactions: [] }]));
    setReplyTo(null);
    requestAnimationFrame(() => scrollToBottom());
    return true;
  };

  const optimistic = (id: string, patch: Partial<MessageWithAuthor>) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const handleReact = async (m: MessageWithAuthor, emoji: string) => {
    const has = (m.reactions ?? []).some((r) => r.profile_id === me.id && r.emoji === emoji);
    const reactions = has
      ? (m.reactions ?? []).filter((r) => !(r.profile_id === me.id && r.emoji === emoji))
      : [...(m.reactions ?? []), { message_id: m.id, profile_id: me.id, emoji, created_at: new Date().toISOString() }];
    optimistic(m.id, { reactions });
    const r = await toggleReaction(m.id, emoji);
    if (!r.ok) toast.error(r.error);
  };

  const handlePin = async (m: MessageWithAuthor) => {
    optimistic(m.id, { pinned: !m.pinned });
    const r = await togglePin(m.id, !m.pinned);
    if (!r.ok) {
      optimistic(m.id, { pinned: m.pinned });
      toast.error(r.error);
    } else toast.success(m.pinned ? "Unpinned" : "Pinned to channel");
  };

  const handleEdit = async (m: MessageWithAuthor, content: string) => {
    if (!content.trim() || content === m.content) return;
    optimistic(m.id, { content, edited_at: new Date().toISOString() });
    const r = await editMessage(m.id, content);
    if (!r.ok) toast.error(r.error);
  };

  const handleDelete = async (m: MessageWithAuthor) => {
    optimistic(m.id, { deleted_at: new Date().toISOString() });
    const r = await deleteMessage(m.id);
    if (!r.ok) toast.error(r.error);
  };

  const runSearch = (q: string) => {
    setSearchQ(q);
    if (q.trim().length < 2) return setSearchResults([]);
    startSearch(async () => setSearchResults(await searchMessages(q, channel.id)));
  };

  const jumpTo = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(id);
      setTimeout(() => setHighlightId(null), 2000);
    } else {
      toast.info("That message is further back than what's loaded.");
    }
  };

  // ---- Render -------------------------------------------------------------
  const title = channel.type === "dm" ? (dmPartner?.roblox_display_name ?? dmPartner?.roblox_username ?? "Direct message") : channel.name;
  const HeaderIcon = channel.type === "dm" ? null : isAnnouncement ? Megaphone : channel.is_private ? Lock : Hash;

  return (
    <>
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        {channel.type === "dm" ? (
          <UserAvatar username={dmPartner?.roblox_username} avatarUrl={dmPartner?.avatar_url} className="size-6" />
        ) : (
          HeaderIcon && <HeaderIcon className="size-4 text-muted-foreground" />
        )}
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        {channel.topic && <span className="hidden truncate border-l pl-2 text-xs text-muted-foreground md:inline">{channel.topic}</span>}
        <div className="ml-auto flex items-center gap-1">
          {/* Pinned */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="relative">
                    <Pin className="size-4" />
                    {pinned.length > 0 && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary" />}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Pinned messages</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-80 p-0">
              <p className="border-b px-3 py-2 text-xs font-semibold">Pinned messages ({pinned.length})</p>
              <div className="max-h-80 overflow-y-auto p-1">
                {pinned.length === 0 && initialPinned.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">Nothing pinned yet. Staff can pin from a message&apos;s hover menu.</p>}
                {(pinned.length ? pinned : initialPinned).map((m) => (
                  <button key={m.id} onClick={() => jumpTo(m.id)} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-accent">
                    <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">{m.author?.roblox_username}</span> · {formatMessageTime(m.created_at)}</p>
                    <p className="line-clamp-2 text-xs">{m.content || "attachment"}</p>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Search */}
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon-sm"><Search className="size-4" /></Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Search this channel</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-96 p-2">
              <Input autoFocus placeholder="Search messages…" value={searchQ} onChange={(e) => runSearch(e.target.value)} />
              <div className="mt-2 max-h-80 overflow-y-auto">
                {searching && <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Searching…</p>}
                {!searching && searchQ.length >= 2 && searchResults.length === 0 && <p className="p-3 text-center text-xs text-muted-foreground">No matches.</p>}
                {searchResults.map((r) => {
                  const author = r.author as unknown as { roblox_username: string } | null;
                  return (
                    <button key={r.id} onClick={() => { jumpTo(r.id); setSearchOpen(false); }} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-accent">
                      <p className="text-[11px] text-muted-foreground"><span className="font-medium text-foreground">{author?.roblox_username}</span> · {formatMessageTime(r.created_at)}</p>
                      <p className="line-clamp-2 text-xs">{r.content}</p>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {channel.type !== "dm" && (isAdmin(me.role) || (channel.department_id && me.role === "department_leader")) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => setEditOpen(true)}><Settings2 className="size-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Channel settings</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} onScroll={onScroll} className="relative flex-1 overflow-y-auto pb-4">
       <div className="flex min-h-full flex-col justify-end">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              {HeaderIcon ? <HeaderIcon className="size-6 text-muted-foreground" /> : <UserAvatar username={dmPartner?.roblox_username} avatarUrl={dmPartner?.avatar_url} className="size-14" />}
            </div>
            <p className="font-medium">{channel.type === "dm" ? `This is the start of your conversation with ${title}.` : `Welcome to #${channel.name}!`}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{channel.topic ?? "This is the very beginning of the channel. Say something!"}</p>
          </div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || !isSameDay(new Date(prev.created_at), new Date(m.created_at));
          const compact =
            !newDay &&
            !!prev &&
            prev.author_id === m.author_id &&
            !m.reply_to_id &&
            !prev.deleted_at &&
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
          const replyTarget = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) ?? null : null;
          return (
            <div key={m.id}>
              {newDay && (
                <div className="my-4 flex items-center gap-3 px-4">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-medium text-muted-foreground">{format(new Date(m.created_at), "EEEE, MMMM d")}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <MessageItem
                message={m}
                me={me}
                members={members}
                compact={compact}
                replyTarget={replyTarget}
                highlight={highlightId === m.id}
                onReply={() => setReplyTo(m)}
                onReact={(e) => handleReact(m, e)}
                onPin={() => handlePin(m)}
                onEdit={(c) => handleEdit(m, c)}
                onDelete={() => handleDelete(m)}
              />
            </div>
          );
        })}
        <div ref={bottomRef} />
       </div>
      </div>

      {/* "New messages" pill */}
      {!atBottom && newCount > 0 && (
        <div className="pointer-events-none relative">
          <button
            onClick={() => scrollToBottom()}
            className="pointer-events-auto absolute -top-10 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground shadow-lg"
          >
            <ArrowDown className="size-3" /> {newCount} new message{newCount > 1 ? "s" : ""}
          </button>
        </div>
      )}

      <MessageComposer
        channelId={channel.id}
        placeholder={channel.type === "dm" ? `Message ${title}` : `Message #${channel.name}`}
        disabled={!canPost}
        disabledReason="Only staff can post in announcement channels."
        members={members}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSend={handleSend}
      />

      {channel.type !== "dm" && (
        <EditChannelDialog channel={channel} open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) router.refresh(); }} canDelete={isAdmin(me.role)} />
      )}
    </>
  );
}
