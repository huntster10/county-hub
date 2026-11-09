"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Hash, Megaphone, Play, Square, Building2, Gavel, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { NAV_SECTIONS } from "./nav-config";
import { hasRoleAtLeast, isStaff } from "@/lib/permissions";
import { endShift, startShift } from "@/server/actions/shifts";
import type { AppRole, Channel, Department } from "@/lib/types/database";

/**
 * Ctrl+K command palette: navigate anywhere, open a channel, or run a quick
 * action without touching the mouse.
 */
export function CommandPalette({
  open,
  onOpenChange,
  role,
  departments,
  channels,
  hasActiveShift,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: AppRole;
  departments: Pick<Department, "id" | "name" | "slug">[];
  channels: Pick<Channel, "id" | "name" | "type">[];
  hasActiveShift: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    onOpenChange(false);
    startTransition(async () => {
      const r = await fn();
      r.ok ? toast.success(success) : toast.error(r.error ?? "Something went wrong");
    });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a page, channel or action…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>

        <CommandGroup heading="Quick actions">
          {hasActiveShift ? (
            <CommandItem onSelect={() => run(() => endShift(), "Shift ended.")}>
              <Square /> End my shift
            </CommandItem>
          ) : (
            <CommandItem onSelect={() => run(() => startShift(null), "Shift started.")}>
              <Play /> Start a shift
            </CommandItem>
          )}
          {isStaff(role) && (
            <CommandItem onSelect={() => go("/staff/punishments?new=1")}>
              <Gavel /> Log a punishment
            </CommandItem>
          )}
          <CommandItem onSelect={() => go("/cad?new=1")}>
            <PlusCircle /> Create a CAD call
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter(
            (i) => (!i.staffOnly || isStaff(role)) && (!i.minRole || hasRoleAtLeast(role, i.minRole)),
          );
          if (!items.length) return null;
          return (
            <CommandGroup key={section.title} heading={section.title}>
              {items.map((i) => (
                <CommandItem key={i.href} onSelect={() => go(i.href)}>
                  <i.icon /> {i.label}
                  {i.shortcut && <CommandShortcut>{i.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}

        {channels.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Channels">
              {channels.map((c) => (
                <CommandItem key={c.id} value={`channel ${c.name}`} onSelect={() => go(`/messages/${c.id}`)}>
                  {c.type === "announcement" ? <Megaphone /> : <Hash />} {c.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {departments.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Departments">
              {departments.map((d) => (
                <CommandItem key={d.id} value={`department ${d.name}`} onSelect={() => go(`/departments/${d.slug}`)}>
                  <Building2 /> {d.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
