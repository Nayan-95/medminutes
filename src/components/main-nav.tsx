"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/practice", label: "Practice" },
  { href: "/mock", label: "Mock test" },
  { href: "/progress", label: "Progress" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

/** Desktop header links; the current section is marked with weight, colour and `aria-current`. */
export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-0.5 sm:flex" aria-label="Main">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-md px-2.5 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
            {active && <span aria-hidden className="absolute inset-x-2.5 -bottom-[11px] h-px bg-foreground" />}
          </Link>
        );
      })}
    </nav>
  );
}
