"use client";

import { ChartColumn, LogOut, Play, Trophy } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { signOutAction } from "@/app/auth-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string | null, email: string | null) {
  const source = name ?? email ?? "?";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function UserMenu({
  name,
  email,
  image,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        data-testid="user-menu"
        className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar>
          {image && <AvatarImage src={image} alt="" referrerPolicy="no-referrer" />}
          <AvatarFallback className="text-xs font-medium">{initials(name, email)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
            <span className="truncate text-sm font-medium text-foreground" data-testid="user-name">
              {name ?? email}
            </span>
            {name && email && <span className="truncate text-xs text-muted-foreground">{email}</span>}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/practice" />}>
            <Play />
            Practice
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/progress" />}>
            <ChartColumn />
            Progress
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/leaderboard" />}>
            <Trophy />
            Leaderboard
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onClick={() => startTransition(() => signOutAction())}
        >
          <LogOut />
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
