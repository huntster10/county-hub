import { cn } from "@/lib/utils";
import { ROLE_LABEL, roleBadgeClass } from "@/lib/permissions";
import type { AppRole } from "@/lib/types/database";

export function RoleBadge({ role, className }: { role: AppRole; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", roleBadgeClass(role), className)}>
      {ROLE_LABEL[role]}
    </span>
  );
}
