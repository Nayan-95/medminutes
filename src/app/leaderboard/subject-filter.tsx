"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { cn } from "@/lib/utils";

/** Subject picker that updates the URL (?subject=), keeping the chosen time window. */
export function SubjectFilter({
  subjects,
  value,
  window,
}: {
  subjects: { id: number; label: string }[];
  value: number | null;
  window: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Subject</span>
      <select
        value={value ?? ""}
        aria-busy={pending}
        onChange={(e) => {
          const params = new URLSearchParams({ window });
          if (e.target.value) params.set("subject", e.target.value);
          startTransition(() => router.push(`/leaderboard?${params}`));
        }}
        className={cn(
          "h-9 rounded-lg border bg-card px-2.5 text-sm shadow-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          pending && "opacity-60",
        )}
      >
        <option value="">All subjects</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
