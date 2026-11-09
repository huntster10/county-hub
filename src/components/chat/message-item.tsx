"use client";

import { useState } from "react";
import Image from "next/image";
import { format, isToday, isYesterday } from "date-fns";
import { Pin, Reply, Pencil, Trash2, SmilePlus, FileText, CornerUpLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { isStaff } from "@/lib/permissions";
import { UserAvatar } from "@/components/shared/user-avatar";
import { RoleBadge } from "@/components/shared/role-badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { MessageContent } from "./message-content";
import type { MessageWithAuthor, Profile } from "@/lib/types/database";

export const QUICK_EMOJI = ["👍", "❤️", "😂", "🔥", "👀", "✅", "🚨", "🫡"];

type MemberLite = Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role">;

export function formatMessageTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return `Today at ${format(d, "p")}`;
  if (isYesterday(d)) return `Yesterday at ${format(d, "p")}`;
  return format(d, "MMM d, yyyy p");
}

export function MessageItem({
  message,
  me,
  members,
  compact,
  replyTarget,
  onReply,
  onReact,
  onPin,
  onEdit,
  onDelete,
  highlight,
}: {
  message: MessageWithAuthor;
  me: Profile;
  members: MemberLite[];
  /** True when the previous message is from the same author within a few minutes. */
  compact: boolean;
  replyTarget?: MessageWithAuthor | null;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onPin: () => void;
  onEdit: (content: string) => void;
  onDelete: () => void;
  highlight?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const mine = message.author_id === me.id;
  const staff = isStaff(me.role);
  const mentioned = message.mentions?.includes(me.id);

  // Group reactions by emoji.
  const reactions = (message.reactions ?? []).reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.emoji] ??= []).push(r.profile_id);
    return acc;
  }, {});

  if (message.deleted_at) {
    return (
      <div className="px-4 py-0.5 text-xs italic text-muted-foreground">
        <span className="ml-11">This message was deleted.</span>
      </div>
    );
  }

  return (
    <div
      id={`msg-${message.id}`}
      className={cn(
        "group relative flex gap-3 px-4 py-0.5 hover:bg-accent/40",
        !compact && "mt-3",
        mentioned && "bg-warning/5 shadow-[inset_2px_0_0_0_var(--warning)]",
        highlight && "bg-primary/10",
        message.pinned && "shadow-[inset_2px_0_0_0_var(--primary)]",
      )}
    >
      {/* Avatar or hover timestamp */}
      <div className="w-8 shrink-0 pt-0.5">
        {!compact ? (
          <UserAvatar username={message.author?.roblox_username} avatarUrl={message.author?.avatar_url} className="size-8" />
        ) : (
          <span className="hidden w-8 text-right text-[10px] leading-5 text-muted-foreground group-hover:block">
            {format(new Date(message.created_at), "p")}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {replyTarget && (
          <div className="mb-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <CornerUpLeft className="size-3" />
            <span className="font-medium">{replyTarget.author?.roblox_username ?? "unknown"}</span>
            <span className="truncate">{replyTarget.deleted_at ? "deleted message" : replyTarget.content || "attachment"}</span>
          </div>
        )}
        {!compact && (
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">{message.author?.roblox_display_name ?? message.author?.roblox_username ?? "Unknown"}</span>
            {message.author && message.author.role !== "member" && <RoleBadge role={message.author.role} />}
            <span className="text-[11px] text-muted-foreground">{formatMessageTime(message.created_at)}</span>
            {message.pinned && <span className="flex items-center gap-0.5 text-[11px] text-primary"><Pin className="size-3" /> pinned</span>}
          </div>
        )}

        {editing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[60px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onEdit(draft);
                  setEditing(false);
                }
                if (e.key === "Escape") setEditing(false);
              }}
            />
            <p className="text-[11px] text-muted-foreground">Enter to save · Esc to cancel</p>
          </div>
        ) : (
          <>
            {message.content && <MessageContent content={message.content} members={members} meId={me.id} />}
            {message.edited_at && <span className="text-[10px] text-muted-foreground">(edited)</span>}
          </>
        )}

        {/* Attachments */}
        {message.attachments?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((a) =>
              a.type.startsWith("image/") ? (
                <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border">
                  <Image src={a.url} alt={a.name} width={320} height={240} className="max-h-60 w-auto object-cover" unoptimized />
                </a>
              ) : (
                <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border bg-background/40 px-3 py-2 text-xs hover:bg-accent">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="max-w-48 truncate">{a.name}</span>
                  <span className="text-muted-foreground">{Math.round(a.size / 1024)} KB</span>
                </a>
              ),
            )}
          </div>
        )}

        {/* Link embeds */}
        {message.embeds?.map((e, i) => (
          <a key={i} href={e.url} target="_blank" rel="noreferrer" className="mt-2 block max-w-md rounded-lg border-l-2 border-primary bg-background/40 p-3 text-xs hover:bg-accent">
            <p className="font-medium text-primary">{e.title}</p>
            {e.description && <p className="mt-0.5 text-muted-foreground">{e.description}</p>}
            {e.image && <Image src={e.image} alt="" width={320} height={200} className="mt-2 max-h-48 w-auto rounded" unoptimized />}
          </a>
        ))}

        {/* Reactions */}
        {Object.keys(reactions).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Object.entries(reactions).map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => onReact(emoji)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-accent",
                  users.includes(me.id) && "border-primary/50 bg-primary/10",
                )}
              >
                <span>{emoji}</span>
                <span className="text-[11px] text-muted-foreground">{users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover action bar */}
      <div className="absolute -top-3 right-4 hidden items-center rounded-md border bg-popover shadow-sm group-hover:flex">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="size-7"><SmilePlus className="size-3.5" /></Button>
          </PopoverTrigger>
          <PopoverContent className="flex w-auto gap-1 p-1.5" align="end">
            {QUICK_EMOJI.map((e) => (
              <button key={e} onClick={() => onReact(e)} className="rounded p-1 text-lg hover:bg-accent">{e}</button>
            ))}
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon-sm" className="size-7" onClick={onReply}><Reply className="size-3.5" /></Button>
        {staff && (
          <Button variant="ghost" size="icon-sm" className="size-7" onClick={onPin}>
            <Pin className={cn("size-3.5", message.pinned && "fill-current text-primary")} />
          </Button>
        )}
        {mine && (
          <Button variant="ghost" size="icon-sm" className="size-7" onClick={() => { setDraft(message.content); setEditing(true); }}>
            <Pencil className="size-3.5" />
          </Button>
        )}
        {(mine || staff) && (
          <Button variant="ghost" size="icon-sm" className="size-7 text-destructive" onClick={onDelete}><Trash2 className="size-3.5" /></Button>
        )}
      </div>
    </div>
  );
}
