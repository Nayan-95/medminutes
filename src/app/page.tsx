import {
  ArrowRight,
  BookOpen,
  ChartColumn,
  CircleCheck,
  CircleMinus,
  CircleX,
  ClipboardList,
  Keyboard,
  Minus,
  Plus,
  RotateCcw,
  Target,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type CSSProperties, type ReactNode } from "react";

import { Reveal } from "@/components/reveal";
import { buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/lib/current-user";
import { getReviewStatus, listSubjects } from "@/lib/practice";
import { cn } from "@/lib/utils";

import { GoogleSignInButton } from "./google-button";

/** Hero items fade up once on load, 80 ms apart (globals.css, off under reduced motion). */
function onLoad(index: number) {
  return { "data-reveal": "shown", style: { "--index": index } as CSSProperties };
}

async function CallToAction({ note = true }: { note?: boolean }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <GoogleSignInButton className="w-full sm:w-auto" />
        {note && <span className="text-sm text-muted-foreground">Free. No card. Your progress is saved.</span>}
      </div>
    );
  }
  const review = await getReviewStatus(user.id);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Link href="/practice" className={cn(buttonVariants({ size: "xl" }), "w-full sm:w-auto")}>
        Start practising
        <ArrowRight data-icon="inline-end" />
      </Link>
      <Link href="/mock" className={cn(buttonVariants({ variant: "outline", size: "xl" }), "w-full bg-card sm:w-auto")}>
        <ClipboardList data-icon="inline-start" />
        Take a mock test
      </Link>
      {review.due > 0 && (
        <Link href="/practice" className={cn(buttonVariants({ variant: "outline", size: "xl" }), "w-full bg-card sm:w-auto")}>
          <RotateCcw data-icon="inline-start" />
          {review.due} due for review
        </Link>
      )}
    </div>
  );
}

async function BankStats() {
  await connection();
  const subjects = await listSubjects();
  const total = subjects.reduce((n, s) => n + s.questionCount, 0);
  const stats = [
    { value: total.toLocaleString("en-IN"), label: "Questions" },
    { value: String(subjects.length), label: "Subjects" },
    { value: "+4 / −1", label: "Marking" },
  ];
  return (
    <dl className="grid grid-cols-3 divide-x border-y">
      {stats.map((s, i) => (
        <div key={s.label} className={cn("py-4", i === 0 ? "pr-4" : "px-4 sm:px-6")}>
          <dt className="eyebrow">{s.label}</dt>
          <dd className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{s.value}</dd>
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

/** A static preview of a revealed question in a minimal window frame, so visitors see the experience first. */
function SampleCard() {
  return (
    <div aria-hidden className="relative">
      <div className="pointer-events-none absolute -inset-10 -z-10 bg-[radial-gradient(50%_50%_at_50%_45%,color-mix(in_oklab,var(--brand)_5%,transparent),transparent)]" />
      <div className="overflow-hidden rounded-xl border bg-card shadow-float">
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
          </span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">medminutes.vercel.app/practice</span>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Anatomy · 3 of 10</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-correct-soft px-2 py-0.5 text-xs font-semibold tabular-nums">
              <CircleCheck className="size-3 text-correct" />
              +4
            </span>
          </div>
          <p className="mt-4 text-[15px] leading-relaxed font-medium">
            A patient cannot extend the wrist after a fracture of the shaft of the humerus. Which nerve is most
            likely injured?
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {SAMPLE_OPTIONS.map((o) => (
              <div
                key={o.key}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm",
                  o.correct ? "border-correct bg-correct-soft" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-md border font-mono text-xs font-semibold",
                    o.correct && "border-correct bg-correct text-white",
                  )}
                >
                  {o.key}
                </span>
                <span className={cn("flex-1", o.correct && "text-foreground")}>{o.text}</span>
                {o.correct && (
                  <span className="flex items-center gap-1 text-xs font-medium text-correct">
                    <CircleCheck className="size-4" />
                    Correct
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 border-l-2 border-correct/50 pl-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Explanation. </span>
            The radial nerve runs in the spiral groove of the humerus and supplies the wrist extensors, so a shaft
            fracture can cause wrist drop.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Bento feature grid ---------- */

const TONES = {
  green: "bg-tag-green text-tag-green-foreground",
  blue: "bg-tag-blue text-tag-blue-foreground",
  yellow: "bg-tag-yellow text-tag-yellow-foreground",
  red: "bg-tag-red text-tag-red-foreground",
} as const;

function Feature({
  icon: Icon,
  tone,
  title,
  children,
  visual,
  className,
  index,
}: {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  title: string;
  children: ReactNode;
  visual?: ReactNode;
  className?: string;
  index: number;
}) {
  return (
    <Reveal index={index} className={cn("flex flex-col gap-6 rounded-xl border bg-card p-6 card-hover sm:p-8", className)}>
      <div>
        <span className={cn("grid size-9 place-items-center rounded-md", TONES[tone])}>
          <Icon className="size-[18px]" strokeWidth={2.25} aria-hidden />
        </span>
        <h3 className="mt-5 text-[17px] font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">{children}</p>
      </div>
      {visual && <div className="mt-auto">{visual}</div>}
    </Reveal>
  );
}

const MARKS = [
  { icon: CircleCheck, label: "Correct", value: "+4", className: "text-correct" },
  { icon: CircleX, label: "Wrong", value: "−1", className: "text-wrong" },
  { icon: CircleMinus, label: "Skipped", value: "0", className: "text-muted-foreground" },
];

function MarkingVisual() {
  return (
    <ul aria-label="Marking scheme" className="grid grid-cols-3 divide-x rounded-lg border">
      {MARKS.map((m) => (
        <li key={m.label} className="flex flex-col gap-1 px-3 py-3 sm:px-4">
          <span className={cn("flex items-center gap-1.5 text-xs font-medium", m.className)}>
            <m.icon className="size-3.5" aria-hidden />
            {m.label}
          </span>
          <span className="font-mono text-xl font-semibold tabular-nums sm:text-2xl">{m.value}</span>
        </li>
      ))}
    </ul>
  );
}

function KeysVisual() {
  return (
    <div aria-hidden className="flex flex-wrap items-center gap-1.5">
      {["1", "2", "3", "4"].map((k) => (
        <Kbd key={k} className="h-7 min-w-7 text-xs">
          {k}
        </Kbd>
      ))}
      <Kbd className="h-7 px-2 text-xs">Enter</Kbd>
      <Kbd className="h-7 min-w-7 text-xs">S</Kbd>
    </div>
  );
}

function MockVisual() {
  return (
    <div aria-hidden className="flex flex-col gap-2">
      <div className="flex gap-1">
        {["A", "B", "C", "D", "E"].map((s, i) => (
          <span
            key={s}
            className={cn(
              "flex h-7 flex-1 items-center justify-center rounded-[4px] font-mono text-[11px]",
              i < 2 ? "bg-foreground/80 text-background" : i === 2 ? "bg-tag-blue text-tag-blue-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            {s}
          </span>
        ))}
      </div>
      <span className="eyebrow">5 sections · 42 min each</span>
    </div>
  );
}

/** Decorative practice heatmap: a fixed pattern, not real data. */
function HeatmapVisual() {
  const levels = "0120130241302140231402310241302041320143024130142031".split("").map(Number);
  const heat = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"];
  return (
    <div aria-hidden className="grid grid-flow-col grid-rows-4 gap-1 overflow-hidden">
      {levels.map((l, i) => (
        <span key={i} className={cn("size-3 rounded-[3px]", heat[l])} />
      ))}
    </div>
  );
}

function Features() {
  return (
    <section aria-labelledby="features-title" className="flex flex-col gap-10">
      <Reveal className="max-w-2xl">
        <p className="eyebrow">What you get</p>
        <h2 id="features-title" className="mt-3 font-display text-3xl leading-tight text-balance sm:text-4xl">
          Short sessions that feel like the real paper.
        </h2>
      </Reveal>
      <div className="grid gap-4 md:grid-cols-6">
        <Feature
          index={0}
          icon={Target}
          tone="green"
          title="Exam-day marking"
          className="md:col-span-4"
          visual={<MarkingVisual />}
        >
          Every answer is scored like NEET PG. A wrong guess costs you, so you learn when to attempt and when to
          leave a question.
        </Feature>
        <Feature index={1} icon={Keyboard} tone="yellow" title="Built for speed" className="md:col-span-2" visual={<KeysVisual />}>
          Practise without the mouse: pick with 1–4, submit with Enter, skip with S.
        </Feature>
        <Feature index={2} icon={BookOpen} tone="blue" title="Learn from every miss" className="md:col-span-2">
          See the key and its explanation as soon as you submit. Got it wrong? Ask the AI why your pick was wrong,
          or type a short doubt.
        </Feature>
        <Feature index={3} icon={RotateCcw} tone="red" title="Reviews at the right time" className="md:col-span-2">
          Questions you miss come back just before you would forget them, scheduled by the FSRS memory model.
        </Feature>
        <Feature index={4} icon={ClipboardList} tone="blue" title="Full mock tests" className="md:col-span-2" visual={<MockVisual />}>
          180 questions in the 2026 pattern, with locked, timed sections. Or a 45-question mini mock.
        </Feature>
        <Feature
          index={5}
          icon={ChartColumn}
          tone="green"
          title="See where you stand"
          className="md:col-span-6 md:flex-row md:items-end md:justify-between"
          visual={<HeatmapVisual />}
        >
          Score trend, weakest subjects, a daily streak and a weekly leaderboard. Each session leans quietly
          toward the topics you need most.
        </Feature>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */

const FAQ = [
  {
    q: "Is MedMinutes free?",
    a: "Yes. Sign in with Google and practise as much as you like. There is no card and no paid plan.",
  },
  {
    q: "Where do the questions come from?",
    a: "From MedMCQA, an open dataset of Indian postgraduate entrance questions. Some carry typos from the source; use “Report a problem” after answering and they get fixed.",
  },
  {
    q: "How is my score worked out?",
    a: "Like the exam: +4 for a correct answer, −1 for a wrong one, 0 for a skip. Your lifetime total sits in the header and feeds the leaderboard.",
  },
  {
    q: "Can I trust the AI explanations?",
    a: "They are a study aid and are labelled “may contain errors”. Only the question, its options and your typed doubt are sent to the model, never your name or email.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Every screen works on a phone. Keyboard shortcuts are a bonus on a laptop.",
  },
];

function Faq() {
  return (
    <section aria-labelledby="faq-title" className="grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
      <Reveal>
        <p className="eyebrow">Questions</p>
        <h2 id="faq-title" className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
          Before you start
        </h2>
      </Reveal>
      <Reveal index={1} className="border-t">
        {FAQ.map((f) => (
          <details key={f.q} className="group border-b">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              {f.q}
              <Plus className="size-4 shrink-0 text-muted-foreground group-open:hidden" aria-hidden />
              <Minus className="hidden size-4 shrink-0 text-muted-foreground group-open:block" aria-hidden />
            </summary>
            <p className="-mt-1 pb-5 text-sm leading-relaxed text-pretty text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </Reveal>
    </section>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col gap-24 sm:gap-32">
      <section className="relative grid items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:pt-6">
        {/* Faint dot grid behind the hero for depth; fades out toward the edges. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-x-4 -top-14 -bottom-10 -z-20 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(70%_60%_at_40%_40%,black,transparent)]"
        />
        <div className="flex flex-col gap-7">
          <span
            {...onLoad(0)}
            className="inline-flex w-fit items-center gap-2 rounded-full bg-tag-green px-2.5 py-1 font-mono text-[11px] font-medium tracking-[0.08em] text-tag-green-foreground uppercase"
          >
            <span className="size-1.5 rounded-full bg-current" />
            NEET PG question bank
          </span>
          <h1 {...onLoad(1)} className="font-display text-[2.75rem] leading-[1.05] text-balance sm:text-6xl lg:text-[4.25rem]">
            Practise like it&apos;s exam day.{" "}
            <em className="text-muted-foreground">A few minutes at a time.</em>
          </h1>
          <p {...onLoad(2)} className="max-w-lg text-lg leading-relaxed text-pretty text-muted-foreground">
            Real NEET PG marking on every question, instant explanations, and a score that tells you exactly where
            you stand.
          </p>
          <div {...onLoad(3)}>
            <Suspense fallback={<Skeleton className="h-11 w-64 rounded-lg" />}>
              <CallToAction />
            </Suspense>
          </div>
          <div {...onLoad(4)}>
            <Suspense fallback={<Skeleton className="h-[86px] w-full rounded-none" />}>
              <BankStats />
            </Suspense>
          </div>
        </div>
        <div {...onLoad(3)}>
          <SampleCard />
        </div>
      </section>

      <Features />

      <Faq />

      <Reveal>
        <section className="flex flex-col items-start justify-between gap-8 rounded-xl border bg-card p-6 sm:p-10 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl leading-tight sm:text-4xl">Ten questions. About ten minutes.</h2>
            <p className="mt-2 text-muted-foreground">Pick a subject, answer, review.</p>
            <p className="mt-3 hidden flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground sm:flex">
              <span className="whitespace-nowrap">
                <Kbd>1</Kbd>–<Kbd>4</Kbd> choose
              </span>
              <span className="whitespace-nowrap">
                <Kbd>Enter</Kbd> submit
              </span>
              <span className="whitespace-nowrap">
                <Kbd>S</Kbd> skip
              </span>
            </p>
          </div>
          <div className="w-full shrink-0 md:w-auto">
            <Suspense fallback={<Skeleton className="h-11 w-48 rounded-lg" />}>
              <CallToAction note={false} />
            </Suspense>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
