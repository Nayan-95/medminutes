import { connection } from "next/server";
import { Suspense } from "react";

import { SubjectIcon, subjectLabel } from "@/components/subject-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserId } from "@/lib/current-user";
import { getReviewStatus, listSubjects, QUESTION_COUNTS } from "@/lib/practice";
import { ReviewBanner } from "@/components/review-banner";
import { cn } from "@/lib/utils";

import { startSession } from "./actions";
import { StartButton } from "./start-button";

const minutesFor = (n: number) => `~${Math.round(n * 1.1)} min`;

function SubjectOption({
  value,
  name,
  label,
  count,
  defaultChecked,
}: {
  value: string;
  name: string | null;
  label: string;
  count: number;
  defaultChecked?: boolean;
}) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer items-center gap-3 rounded-xl border bg-card p-3 shadow-card transition-all",
        "hover:border-foreground/20 hover:shadow-float",
        "has-checked:border-foreground has-checked:ring-1 has-checked:ring-foreground",
        "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
      )}
    >
      <input
        type="radio"
        name="subjectId"
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
        aria-label={`${label}, ${count.toLocaleString("en-IN")} questions`}
      />
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-has-checked:bg-foreground group-has-checked:text-background">
        <SubjectIcon name={name} className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {count.toLocaleString("en-IN")} questions
        </span>
      </span>
    </label>
  );
}

async function SetupForm() {
  // Request time, not build time: builds (and CI) need no database, and the
  // subject list reflects the latest import. listSubjects() is still cached.
  await connection();
  const userId = await requireUserId("/practice");
  const [subjects, review] = await Promise.all([listSubjects(), getReviewStatus(userId)]);
  const total = subjects.reduce((n, s) => n + s.questionCount, 0);

  return (
    <div className="flex flex-col gap-8">
      <ReviewBanner {...review} now={new Date()} />
      <form action={startSession} className="grid gap-8 lg:grid-cols-[1fr_300px] lg:items-start">
        <input type="hidden" name="kind" value="practice" />
        <fieldset>
          <legend className="mb-3 text-sm font-medium">Subject</legend>
          <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 md:grid-cols-3">
            <SubjectOption value="all" name={null} label="All subjects" count={total} defaultChecked />
            {subjects.map((s) => (
              <SubjectOption
                key={s.id}
                value={String(s.id)}
                name={s.name}
                label={subjectLabel(s.name)}
                count={s.questionCount}
              />
            ))}
          </div>
        </fieldset>

        <aside className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-card lg:sticky lg:top-20">
          <fieldset>
            <legend className="mb-3 text-sm font-medium">Questions</legend>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
              {QUESTION_COUNTS.map((n) => (
                <label
                  key={n}
                  className="flex cursor-pointer flex-col items-center rounded-lg py-2 text-sm font-semibold tabular-nums transition-all has-checked:bg-card has-checked:shadow-card has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                >
                  <input type="radio" name="count" value={n} defaultChecked={n === 10} className="sr-only" />
                  {n}
                  <span className="text-[11px] font-normal text-muted-foreground">{minutesFor(n)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-1.5 font-medium text-foreground">NEET PG marking</p>
            <ul className="grid grid-cols-3 gap-2 text-center tabular-nums">
              <li className="rounded-lg bg-card py-1.5">
                <span className="block text-sm font-semibold text-foreground">+4</span>correct
              </li>
              <li className="rounded-lg bg-card py-1.5">
                <span className="block text-sm font-semibold text-foreground">−1</span>wrong
              </li>
              <li className="rounded-lg bg-card py-1.5">
                <span className="block text-sm font-semibold text-foreground">0</span>skipped
              </li>
            </ul>
          </div>

          <StartButton className="w-full" />
        </aside>
      </form>
    </div>
  );
}

function SetupSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 md:grid-cols-3">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-[62px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[280px] rounded-2xl" />
    </div>
  );
}

export default function PracticeSetupPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">New practice session</h1>
        <p className="mt-1.5 text-muted-foreground">
          Choose a subject and how many questions. You&apos;ll see the answer after each one.
        </p>
      </div>
      <Suspense fallback={<SetupSkeleton />}>
        <SetupForm />
      </Suspense>
    </div>
  );
}
