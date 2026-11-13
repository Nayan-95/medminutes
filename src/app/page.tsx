import { ArrowRight, BookOpen, CircleCheck, Keyboard, Target } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/current-user";
import { listSubjects } from "@/lib/practice";
import { cn } from "@/lib/utils";

import { GoogleSignInButton } from "./google-button";

async function CallToAction() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <GoogleSignInButton className="w-full sm:w-auto" />
        <span className="text-sm text-muted-foreground">Free. No card. Your progress is saved.</span>
      </div>
    );
  }
  return (
    <Link href="/practice" className={cn(buttonVariants({ size: "xl" }), "w-full sm:w-auto")}>
      Start practising
      <ArrowRight data-icon="inline-end" />
    </Link>
  );
}

async function BankStats() {
  await connection();
  const subjects = await listSubjects();
  const total = subjects.reduce((n, s) => n + s.questionCount, 0);
  const stats = [
    { value: total.toLocaleString("en-IN"), label: "questions" },
    { value: String(subjects.length), label: "subjects" },
    { value: "+4 / −1", label: "real marking" },
  ];
  return (
    <dl className="grid grid-cols-3 divide-x divide-border rounded-2xl border bg-card shadow-card">
      {stats.map((s) => (
        <div key={s.label} className="px-4 py-4 sm:px-6">
          <dt className="text-xs text-muted-foreground sm:text-sm">{s.label}</dt>
          <dd className="mt-1 text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const SAMPLE_OPTIONS = [
  { key: "A", text: "Ulnar nerve" },
  { key: "B", text: "Median nerve" },
  { key: "C", text: "Radial nerve", correct: true },
  { key: "D", text: "Axillary nerve" },
];

/** A static preview of a revealed question, so visitors see the experience before signing in. */
function SampleCard() {
  return (
    <div aria-hidden className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[radial-gradient(60%_60%_at_50%_40%,color-mix(in_oklab,var(--brand)_18%,transparent),transparent)]" />
      <div className="rounded-2xl border bg-card p-5 shadow-float sm:p-6">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Anatomy · Question 3 of 10</span>
          <span className="rounded-full bg-correct-soft px-2 py-0.5 font-semibold text-foreground">+4</span>
        </div>
        <p className="mt-4 text-[15px] font-medium leading-relaxed">
          A patient cannot extend the wrist after a fracture of the shaft of the humerus. Which nerve is
          most likely injured?
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {SAMPLE_OPTIONS.map((o) => (
            <div
              key={o.key}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm",
                o.correct ? "border-correct bg-correct-soft" : "opacity-55",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-md border text-xs font-semibold",
                  o.correct && "border-correct bg-correct text-white",
                )}
              >
                {o.key}
              </span>
              <span className="flex-1">{o.text}</span>
              {o.correct && <CircleCheck className="size-4 text-correct" />}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Explanation · </span>
          The radial nerve runs in the spiral groove of the humerus and supplies the wrist extensors, so a
          shaft fracture can cause wrist drop.
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    icon: Target,
    title: "Exam-day marking",
    body: "Every answer is scored like the real NEET PG: +4 correct, −1 wrong, 0 skipped. Learn when to attempt and when to leave.",
  },
  {
    icon: BookOpen,
    title: "Learn from every miss",
    body: "See the right answer and a clear explanation the moment you submit, while the question is still fresh.",
  },
  {
    icon: Keyboard,
    title: "Built for speed",
    body: "Practise without touching the mouse. Pick with 1–4, submit with Enter, skip with S.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-16 sm:gap-24">
      <section className="grid items-center gap-12 pt-2 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-8">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
            <span className="size-1.5 rounded-full bg-brand" />
            NEET PG question bank
          </span>
          <h1 className="text-4xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
            Practise like it&apos;s exam day.
            <span className="text-muted-foreground"> A few minutes at a time.</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">
            Real NEET PG marking on every question, instant explanations, and a score that tells you
            exactly where you stand.
          </p>
          <Suspense fallback={<Skeleton className="h-11 w-64 rounded-xl" />}>
            <CallToAction />
          </Suspense>
          <Suspense fallback={<Skeleton className="h-[84px] w-full rounded-2xl" />}>
            <BankStats />
          </Suspense>
        </div>
        <SampleCard />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-card">
            <span className="grid size-9 place-items-center rounded-lg bg-muted">
              <f.icon className="size-[18px] text-brand" aria-hidden />
            </span>
            <h2 className="mt-4 font-semibold tracking-tight">{f.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col items-start justify-between gap-6 rounded-2xl border bg-card p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Ten questions. About ten minutes.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a subject, answer, review. Shortcuts: <Kbd>1</Kbd>–<Kbd>4</Kbd> choose · <Kbd>Enter</Kbd>{" "}
            submit · <Kbd>S</Kbd> skip
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-11 w-48 rounded-xl" />}>
          <CallToAction />
        </Suspense>
      </section>
    </div>
  );
}
