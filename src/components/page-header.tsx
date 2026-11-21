import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Page title block used on every top-level page: serif title, muted lead, optional action, hairline rule. */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 border-b pb-6", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-4xl leading-[1.1] text-balance sm:text-[2.75rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl leading-relaxed text-pretty text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
