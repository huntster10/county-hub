"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronDown, Hash, Lock, Megaphone, Plus, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/shared/user-avatar";
import { NewChannelDialog, NewDmDialog } from "./channel-dialogs";
import type { ChannelLite, ChannelTree } from "@/lib/data/messages";
import type { Department, Profile } from "@/lib/types/database";

type MemberLite = Pick<Profile, "id" | "roblox_username" | "roblox_display_name" | "avatar_url" | "role">;

export function ChannelSidebar({
  tree,
  profile,
  members,
  departments,
}: {
  tree: ChannelTree;
  profile: Profile;
  members: MemberLite[];
  departments: Pick<Department, "id" | "name" | "color">[];
}) {
  const params = useParams<{ channelId?: string }>();
  const active = params?.channelId;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [newChannel, setNewChannel] = useState(false);
  const [newDm, setNewDm] = useState(false);
  const admin = isAdmin(profile.role);

  const ChannelLink = ({ ch }: { ch: ChannelLite }) => {
    const unread = tree.unread[ch.id] ?? 0;
    const isActive = active === ch.id;
    const Icon = ch.type === "announcement" ? Megaphone : ch.is_private ? Lock : Hash;
    return (
      <Link
        href={`/messages/${ch.id}`}
        className={cn(
          "group flex h-7 items-center gap-1.5 rounded-md px-2 text-sm transition-colors",
          isActive ? "bg-accent text-foreground" : unread ? "text-foreground hover:bg-accent/60" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )}
      >
        <Icon className="size-3.5 shrink-0 opacity-70" />
        <span className={cn("flex-1 truncate", unread && !isActive && "font-semibold")}>{ch.name}</span>
        {unread > 0 && !isActive && (
          <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">{unread > 99 ? "99+" : unread}</span>
        )}
      </Link>
    );
  };

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-12 items-center justify-between border-b px-3">
        <p className="text-sm font-semibold">Channels</p>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => setNewDm(true)}><MessageSquarePlus className="size-4" /></Button>
            </TooltipTrigger>
            <TooltipContent>New direct message</TooltipContent>
          </Tooltip>
          {admin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => setNewChannel(true)}><Plus className="size-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>New channel</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-2">
          {tree.uncategorised.length > 0 && (
            <div className="space-y-0.5">{tree.uncategorised.map((ch) => <ChannelLink key={ch.id} ch={ch} />)}</div>
          )}

          {tree.categories.map((cat) => {
            const isCollapsed = collapsed[cat.id];
            const catUnread = cat.channels.reduce((a, c) => a + (tree.unread[c.id] ?? 0), 0);
            return (
              <div key={cat.id}>
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))}
                  className="flex w-full items-center gap-1 px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className={cn("size-3 transition-transform", isCollapsed && "-rotate-90")} />
                  <span className="flex-1 truncate text-left">{cat.name}</span>
                  {isCollapsed && catUnread > 0 && <span className="size-1.5 rounded-full bg-primary" />}
                </button>
                {!isCollapsed && <div className="space-y-0.5">{cat.channels.map((ch) => <ChannelLink key={ch.id} ch={ch} />)}</div>}
              </div>
            );
          })}

          <div>
            <p className="px-1 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Direct messages</p>
            {tree.dms.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">No DMs yet — click the + icon above.</p>}
            <div className="space-y-0.5">
              {tree.dms.map(({ channel, other }) => {
                const unread = tree.unread[channel.id] ?? 0;
                const isActive = active === channel.id;
                return (
                  <Link
                    key={channel.id}
                    href={`/messages/${channel.id}`}
                    className={cn(
                      "flex h-8 items-center gap-2 rounded-md px-2 text-sm transition-colors",
                      isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <UserAvatar username={other?.roblox_username} avatarUrl={other?.avatar_url} className="size-5" />
                    <span className={cn("flex-1 truncate", unread && !isActive && "font-semibold text-foreground")}>
                      {other?.roblox_display_name ?? other?.roblox_username ?? "Unknown user"}
                    </span>
                    {unread > 0 && !isActive && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">{unread}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>

      <NewChannelDialog open={newChannel} onOpenChange={setNewChannel} categories={tree.categories} departments={departments} />
      <NewDmDialog open={newDm} onOpenChange={setNewDm} members={members} meId={profile.id} />
    </aside>
  );
}
