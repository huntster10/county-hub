"use client";

import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { RoleBadge } from "@/components/shared/role-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isAdmin } from "@/lib/permissions";
import type { Profile } from "@/lib/types/database";

export function UserMenu({ profile }: { profile: Profile }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
        <UserAvatar username={profile.roblox_username} avatarUrl={profile.avatar_url} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            <UserAvatar username={profile.roblox_username} avatarUrl={profile.avatar_url} className="size-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{profile.roblox_display_name ?? profile.roblox_username}</p>
              <p className="truncate text-xs text-muted-foreground">@{profile.roblox_username}</p>
              <div className="mt-1"><RoleBadge role={profile.role} /></div>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/members/${profile.id}`}><User /> My profile</Link>
        </DropdownMenuItem>
        {isAdmin(profile.role) && (
          <DropdownMenuItem asChild>
            <Link href="/settings"><Settings /> Server settings</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <form action="/api/auth/logout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full text-destructive focus:text-destructive"><LogOut /> Sign out</button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
