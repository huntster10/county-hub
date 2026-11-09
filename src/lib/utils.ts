import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names safely (shadcn/ui convention). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Turn "Police Department" into "police-department". */
export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Initials for avatar fallbacks: "Joe Smith" -> "JS". */
export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** "1h 23m" style duration from milliseconds. */
export function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * ER:LC returns players as "Username:RobloxId". Split that into parts.
 */
export function parseErlcPlayer(value: string) {
  const idx = value.lastIndexOf(":");
  if (idx === -1) return { username: value, robloxId: null as string | null };
  return { username: value.slice(0, idx), robloxId: value.slice(idx + 1) };
}

/** Roblox headshot thumbnail URL via the public thumbnails API redirect. */
export function robloxAvatarUrl(robloxId: string | number | null | undefined) {
  if (!robloxId) return null;
  return `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png`;
}

/** Minutes → "3h 20m" (used by charts, tables and KPI tiles). */
export function minutesLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
