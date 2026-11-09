import {
  LayoutDashboard, MessageSquare, Users, Building2, Clock, Gavel, Radar, Activity, Trophy, ClipboardList,
  Siren, CalendarClock, Settings, type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/types/database";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Minimum role to see the link. */
  minRole?: AppRole;
  /** Only moderation staff (owner/admin/staff). */
  staffOnly?: boolean;
  /** Keyboard shortcut hint shown in the command palette. */
  shortcut?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, shortcut: "G D" },
      { label: "Messages", href: "/messages", icon: MessageSquare, shortcut: "G M" },
      { label: "Members", href: "/members", icon: Users },
      { label: "Departments", href: "/departments", icon: Building2 },
    ],
  },
  {
    title: "Community",
    items: [
      { label: "Sessions", href: "/sessions", icon: CalendarClock },
      { label: "Applications", href: "/applications", icon: ClipboardList },
      { label: "CAD / Dispatch", href: "/cad", icon: Siren },
    ],
  },
  {
    title: "Staff",
    items: [
      { label: "Shifts", href: "/staff/shifts", icon: Clock, staffOnly: true },
      { label: "Punishments", href: "/staff/punishments", icon: Gavel, staffOnly: true },
      { label: "Live Players", href: "/staff/players", icon: Radar, staffOnly: true },
      { label: "Event Feed", href: "/staff/events", icon: Activity, staffOnly: true },
      { label: "Leaderboard", href: "/staff/leaderboard", icon: Trophy, staffOnly: true },
    ],
  },
  {
    title: "Admin",
    items: [{ label: "Settings", href: "/settings", icon: Settings, minRole: "admin" }],
  },
];
