"use client";

import { useState } from "react";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Sidebar, type SidebarProps } from "./sidebar";
import { ShiftControls } from "./shift-controls";
import { UserMenu } from "./user-menu";
import { CommandPalette } from "./command-palette";
import type { Channel, Department, Profile, Shift } from "@/lib/types/database";

export function Topbar({
  profile,
  activeShift,
  departments,
  channels,
  sidebar,
}: {
  profile: Profile;
  activeShift: Shift | null;
  departments: Pick<Department, "id" | "name" | "slug">[];
  channels: Pick<Channel, "id" | "name" | "type">[];
  sidebar: SidebarProps;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
          <Menu className="size-5" />
        </Button>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar {...sidebar} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Search / palette trigger */}
      <button
        onClick={() => setPaletteOpen(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted/70"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="hidden rounded border bg-background px-1.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <ShiftControls activeShift={activeShift} departments={departments} />
        <UserMenu profile={profile} />
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        role={profile.role}
        departments={departments}
        channels={channels}
        hasActiveShift={Boolean(activeShift)}
      />
    </header>
  );
}
