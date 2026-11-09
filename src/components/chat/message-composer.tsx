"use client";

import { useRef, useState } from "react";
import { Paperclip, Send, X, Loader2, SmilePlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/shared/user-avatar";
import { QUICK_EMOJI } from "./message-item";
import type { Attachment, MessageWithAuthor, Profile } from "@/lib/types/database";

type MemberLite = Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role">;

export function MessageComposer({
  channelId,
  placeholder,
  disabled,
  disabledReason,
  members,
  replyTo,
  onCancelReply,
  onSend,
}: {
  channelId: string;
  placeholder: string;
  disabled?: boolean;
  disabledReason?: string;
  members: MemberLite[];
  replyTo: MessageWithAuthor | null;
  onCancelReply: () => void;
  onSend: (content: string, attachments: Attachment[]) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mentionMatches = mentionQuery !== null
    ? members.filter((m) => m.roblox_username.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 6)
    : [];

  const updateMentionState = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const m = before.match(/(?:^|\s)@([A-Za-z0-9_]*)$/);
    setMentionQuery(m ? m[1] : null);
    setMentionIndex(0);
  };

  const insertMention = (username: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = value.slice(0, caret).replace(/@[A-Za-z0-9_]*$/, `@${username} `);
    const next = before + value.slice(caret);
    setValue(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(before.length, before.length);
    });
  };

  const submit = async () => {
    if (sending || uploading) return;
    if (!value.trim() && attachments.length === 0) return;
    setSending(true);
    const ok = await onSend(value, attachments);
    setSending(false);
    if (ok) {
      setValue("");
      setAttachments([]);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionMatches.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => (i + 1) % mentionMatches.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionMatches[mentionIndex].roblox_username); return; }
      if (e.key === "Escape") { setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const supabase = createClient();
    for (const file of Array.from(files).slice(0, 5 - attachments.length)) {
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} is over 10 MB`); continue; }
      const path = `${channelId}/${Date.now()}-${file.name.replace(/[^A-Za-z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: false });
      if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
      const { data } = supabase.storage.from("attachments").getPublicUrl(path);
      setAttachments((a) => [...a, { url: data.publicUrl, name: file.name, size: file.size, type: file.type }]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (disabled) {
    return (
      <div className="border-t p-3">
        <div className="rounded-lg border bg-muted/40 px-3 py-2.5 text-center text-xs text-muted-foreground">{disabledReason ?? "You can't post here."}</div>
      </div>
    );
  }

  return (
    <div className="relative border-t p-3">
      {/* Mention autocomplete */}
      {mentionMatches.length > 0 && (
        <div className="absolute bottom-full left-3 mb-1 w-64 rounded-md border bg-popover p-1 shadow-lg">
          {mentionMatches.map((m, i) => (
            <button
              key={m.id}
              onMouseDown={(e) => { e.preventDefault(); insertMention(m.roblox_username); }}
              className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${i === mentionIndex ? "bg-accent" : "hover:bg-accent/60"}`}
            >
              <UserAvatar username={m.roblox_username} avatarUrl={m.avatar_url} className="size-5" />
              <span className="truncate">{m.roblox_username}</span>
              {m.roblox_display_name && m.roblox_display_name !== m.roblox_username && <span className="truncate text-xs text-muted-foreground">{m.roblox_display_name}</span>}
            </button>
          ))}
        </div>
      )}

      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">Replying to</span>
          <span className="font-medium">{replyTo.author?.roblox_username}</span>
          <span className="flex-1 truncate text-muted-foreground">{replyTo.content}</span>
          <button onClick={onCancelReply} className="rounded p-0.5 hover:bg-accent"><X className="size-3.5" /></button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((a) => (
            <span key={a.url} className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs">
              <Paperclip className="size-3" /> <span className="max-w-40 truncate">{a.name}</span>
              <button onClick={() => setAttachments((list) => list.filter((x) => x.url !== a.url))}><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 rounded-lg border bg-background/40 p-1.5 focus-within:ring-2 focus-within:ring-ring/40">
        <input ref={fileRef} type="file" multiple hidden accept="image/*,.pdf,.txt" onChange={(e) => upload(e.target.files)} />
        <Button variant="ghost" size="icon-sm" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Attach file">
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
        </Button>
        <textarea
          ref={textareaRef}
          value={value}
          placeholder={placeholder}
          rows={1}
          onChange={(e) => {
            setValue(e.target.value);
            updateMentionState(e.target.value, e.target.selectionStart);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
          }}
          onKeyDown={onKeyDown}
          className="max-h-[200px] min-h-[32px] flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Emoji"><SmilePlus className="size-4" /></Button>
          </PopoverTrigger>
          <PopoverContent className="flex w-auto gap-1 p-1.5" align="end">
            {QUICK_EMOJI.map((e) => (
              <button key={e} onClick={() => setValue((v) => v + e)} className="rounded p-1 text-lg hover:bg-accent">{e}</button>
            ))}
          </PopoverContent>
        </Popover>
        <Button size="icon-sm" onClick={submit} disabled={sending || uploading || (!value.trim() && attachments.length === 0)} aria-label="Send">
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
      <p className="mt-1 px-1 text-[10px] text-muted-foreground">Enter to send · Shift+Enter for a new line · @ to mention · **bold** and `code`</p>
    </div>
  );
}
