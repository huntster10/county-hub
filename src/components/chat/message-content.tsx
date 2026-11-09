"use client";

import Link from "next/link";
import type { Profile } from "@/lib/types/database";

type MemberLite = Pick<Profile, "id" | "roblox_username">;

const TOKEN_RE = /(@[A-Za-z0-9_]{3,20}|https?:\/\/[^\s)]+|`[^`]+`|\*\*[^*]+\*\*)/g;

/**
 * Renders message text with:
 *  - @mentions highlighted (and linked to the member's profile)
 *  - URLs turned into links
 *  - `inline code` and **bold** (the two bits of formatting people actually use)
 */
export function MessageContent({ content, members, meId }: { content: string; members: MemberLite[]; meId: string }) {
  const parts = content.split(TOKEN_RE);
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("@")) {
          const member = members.find((m) => m.roblox_username.toLowerCase() === part.slice(1).toLowerCase());
          if (!member) return <span key={i}>{part}</span>;
          const isMe = member.id === meId;
          return (
            <Link
              key={i}
              href={`/members/${member.id}`}
              className={`rounded px-1 font-medium ${isMe ? "bg-warning/25 text-warning" : "bg-primary/15 text-primary"} hover:underline`}
            >
              {part}
            </Link>
          );
        }
        if (part.startsWith("http")) {
          return (
            <a key={i} href={part} target="_blank" rel="noreferrer noopener" className="text-primary underline underline-offset-2 hover:opacity-80">
              {part}
            </a>
          );
        }
        if (part.startsWith("`")) return <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">{part.slice(1, -1)}</code>;
        if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
