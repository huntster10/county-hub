import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function UserAvatar({
  username,
  avatarUrl,
  className,
}: {
  username: string | null | undefined;
  avatarUrl: string | null | undefined;
  className?: string;
}) {
  return (
    <Avatar className={cn("size-8", className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={username ?? ""} />}
      <AvatarFallback className="bg-primary/15 text-primary">{initials(username)}</AvatarFallback>
    </Avatar>
  );
}
