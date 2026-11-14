"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SubjectIcon, subjectLabel } from "@/components/subject-icon";
import { cn } from "@/lib/utils";

import { startSession } from "./actions";
import { StartButton } from "./start-button";

const minutesFor = (n: number) => `~${Math.round(n * 1.1)} min`;

interface SubjectChoice {
  value: string;
  name: string | null;
  label: string;
  count: number;
}

function StepHeading({ step, title, done }: { step: number; title: string; done?: boolean }) {
  return (
    <h2 className="mb-3 flex items-center gap-2.5 text-sm font-medium">
      <span
        aria-hidden
        className={cn(
          "grid size-6 place-items-center rounded-full text-xs font-semibold tabular-nums transition-colors",
          done ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
        )}
      >
        {done ? <Check className="size-3.5" /> : step}
      </span>
      <span>
        <span className="sr-only">Step {step}: </span>
        {title}
      </span>
    </h2>
  );
}

function SubjectOption({ choice, onPick }: { choice: SubjectChoice; onPick: (c: SubjectChoice) => void }) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer items-center gap-2.5 rounded-xl border bg-card p-2.5 shadow-card transition-all sm:gap-3 sm:p-3",
        "hover:border-foreground/20 hover:shadow-float",
        "has-checked:border-foreground has-checked:ring-1 has-checked:ring-foreground",
        "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
      )}
    >
      <input
        type="radio"
        name="subjectId"
        value={choice.value}
        required
        onChange={() => onPick(choice)}
        className="sr-only"
        aria-label={`${choice.label}, ${choice.count.toLocaleString("en-IN")} questions`}
      />
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-has-checked:bg-foreground group-has-checked:text-background">
        <SubjectIcon name={choice.name} className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm leading-snug font-medium">{choice.label}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {choice.count.toLocaleString("en-IN")} questions
        </span>
      </span>
    </label>
  );
}

/**
 * Practice setup in steps: 1. subject → 2. questions and time → Start.
 * Step 2 appears (and scrolls into view) only after a subject is picked.
 */
export function SetupForm({
  subjects,
  total,
  counts,
}: {
  subjects: { id: number; name: string; questionCount: number }[];
  total: number;
  counts: readonly number[];
}) {
  const [picked, setPicked] = useState<SubjectChoice | null>(null);
  const step2 = useRef<HTMLElement>(null);
  const [scrollKey, setScrollKey] = useState(0);

  useEffect(() => {
    if (scrollKey === 0 || !step2.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    step2.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  }, [scrollKey]);

  const choices: SubjectChoice[] = [
    { value: "all", name: null, label: "All subjects", count: total },
    ...subjects.map((s) => ({ value: String(s.id), name: s.name, label: subjectLabel(s.name), count: s.questionCount })),
  ];

  function pick(c: SubjectChoice) {
    setPicked(c);
    setScrollKey((k) => k + 1);
  }

  return (
    <form action={startSession} className="flex flex-col gap-8">
      <input type="hidden" name="kind" value="practice" />

      <fieldset>
        <legend className="contents">
          <StepHeading step={1} title="Choose a subject" done={picked !== null} />
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-3 lg:grid-cols-4">
          {choices.map((c) => (
            <SubjectOption key={c.value} choice={c} onPick={pick} />
          ))}
        </div>
      </fieldset>

      {picked ? (
        <section
          ref={step2}
          aria-labelledby="step-2-title"
          data-testid="setup-step-2"
          className="animate-rise scroll-mb-6 rounded-2xl border bg-card p-5 shadow-card sm:p-6"
        >
          <div id="step-2-title">
            <StepHeading step={2} title="Questions and time" />
          </div>
          <p className="-mt-1 mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <SubjectIcon name={picked.name} className="size-4" />
            <span>
              <span className="font-medium text-foreground">{picked.label}</span> · questions picked to strengthen your weak topics
            </span>
          </p>

          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
            <fieldset>
              <legend className="mb-2 text-xs font-medium text-muted-foreground">How many questions?</legend>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {counts.map((n) => (
                  <label
                    key={n}
                    className="flex cursor-pointer flex-col items-center rounded-lg py-2.5 text-sm font-semibold tabular-nums transition-all has-checked:bg-card has-checked:shadow-card has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
                  >
                    <input type="radio" name="count" value={n} defaultChecked={n === counts[0]} className="sr-only" />
                    {n}
                    <span className="text-[11px] font-normal text-muted-foreground">{minutesFor(n)}</span>
                  </label>
                ))}
              </div>
              <p className="mt-2.5 text-xs text-muted-foreground">
                NEET PG marking: <span className="font-medium text-foreground tabular-nums">+4</span> correct ·{" "}
                <span className="font-medium text-foreground tabular-nums">−1</span> wrong ·{" "}
                <span className="font-medium text-foreground tabular-nums">0</span> skipped
              </p>
            </fieldset>

            <StartButton className="w-full md:w-auto md:min-w-48" />
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground" data-testid="setup-hint">
          Pick a subject to choose how many questions.
        </p>
      )}
    </form>
  );
}
