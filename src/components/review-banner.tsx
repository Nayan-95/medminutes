import { CalendarClock, RotateCcw } from "lucide-react";

import { startSession } from "@/app/practice/actions";
import { StartButton } from "@/app/practice/start-button";
import { describeNextReview } from "@/lib/srs";
import { cn } from "@/lib/utils";

/** Largest review session we start in one go. */
const MAX_REVIEW = 20;

/**
 * Spaced-repetition call to action. Renders nothing until the user has answered
 * at least one question (no cards yet).
 */
export function ReviewBanner({
  due,
  nextDueAt,
  total,
  now,
  className,
}: {
  due: number;
  nextDueAt: Date | null;
  total: number;
  now: Date;
  className?: string;
}) {
  if (total === 0) return null;

  if (due === 0) {
    return (
      <p
        data-testid="review-banner"
        data-due={0}
        className={cn("flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground shadow-card", className)}
      >
        <CalendarClock className="size-4 shrink-0 text-brand" aria-hidden />
        <span>
          Nothing due for review.
          {nextDueAt && <> Next review {describeNextReview(nextDueAt, now)}.</>}
          <span className="hidden sm:inline"> {total.toLocaleString("en-IN")} questions in your review deck.</span>
        </span>
      </p>
    );
  }

  const count = Math.min(due, MAX_REVIEW);
  return (
    <section
      data-testid="review-banner"
      data-due={due}
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-brand/30 bg-[color-mix(in_oklab,var(--brand)_7%,var(--card))] p-5 shadow-card sm:flex-row sm:items-center",
        className,
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground">
        <RotateCcw className="size-5" aria-hidden />
      </span>
      <div className="flex-1">
        <h2 className="font-semibold tracking-tight">
          {due.toLocaleString("en-IN")} {due === 1 ? "question" : "questions"} due for review
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Spaced repetition brings back what you&apos;re about to forget. A few minutes now saves hours later.
        </p>
      </div>
      <form action={startSession}>
        <input type="hidden" name="kind" value="review" />
        <input type="hidden" name="count" value={count} />
        <StartButton label={due > MAX_REVIEW ? `Review ${count}` : "Start review"} className="w-full sm:w-auto" />
      </form>
    </section>
  );
}
