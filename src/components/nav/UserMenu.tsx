import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FeedbackMenuItem } from "@/components/feedback/FeedbackMenuItem";

type UserMenuProps = {
  email: string;
  displayName: string | null;
  tone?: "light" | "dark";
};

function initials(source: string): string {
  const parts = source.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserMenu({ email, displayName, tone = "light" }: UserMenuProps) {
  const label = displayName || email;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={
            tone === "dark"
              ? "min-h-[44px] min-w-[44px] gap-2 text-white hover:bg-white/10 hover:text-white"
              : "min-h-[44px] min-w-[44px] gap-2"
          }
          aria-label="Account menu"
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-brand-cobalt-100 text-brand-navy-900 text-xs font-semibold">
              {initials(label)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col">
            {displayName ? (
              <span className="text-sm font-semibold leading-tight">
                {displayName}
              </span>
            ) : null}
            <span className="text-muted-foreground text-xs leading-tight">
              {email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <FeedbackMenuItem />
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-2"
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
