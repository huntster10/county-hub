import type { AppRole } from "@/lib/types/database";

/** Numeric weight for each role (mirrors role_rank() in the database). */
export const ROLE_RANK: Record<AppRole, number> = {
  owner: 100,
  admin: 80,
  staff: 60,
  department_leader: 50,
  member: 10,
};

export const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
  department_leader: "Dept. Leader",
  member: "Member",
};

/** Roles an admin can hand out from the UI (owner is transferred separately). */
export const ASSIGNABLE_ROLES: AppRole[] = ["admin", "staff", "department_leader", "member"];

export function hasRoleAtLeast(role: AppRole | null | undefined, min: AppRole) {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Moderation staff: owner, admin, staff. */
export function isStaff(role: AppRole | null | undefined) {
  return role === "owner" || role === "admin" || role === "staff";
}

export function isAdmin(role: AppRole | null | undefined) {
  return role === "owner" || role === "admin";
}

/** Tailwind classes for a role badge. */
export function roleBadgeClass(role: AppRole) {
  switch (role) {
    case "owner":
      return "bg-chart-4/20 text-chart-4";
    case "admin":
      return "bg-chart-8/20 text-chart-8";
    case "staff":
      return "bg-primary/20 text-primary";
    case "department_leader":
      return "bg-chart-7/20 text-chart-7";
    default:
      return "bg-muted text-muted-foreground";
  }
}
