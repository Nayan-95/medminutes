import { CircleAlert, Clock, Flag, Layers, Lock, PlayCircle } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ScorePill } from "@/components/score-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserId } from "@/lib/current-user";
import { formatPercent } from "@/lib/format";
import { MOCK_FORMATS, mockClock, totalQuestions, totalSeconds, type MockFormat } from "@/lib/mock";
import { finalizeExpiredMocks, formatOf, listMocks } from "@/lib/mock-data";

import { StartButton } from "../practice/start-button";
import { startMock } from "./actions";

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function duration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? (m > 0 ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

function FormatOption({ f, defaultChecked }: { f: MockFormat; defaultChecked?: boolean }) {
  const perSection = f.sectionSeconds / 60;
  return (
    <label className="group flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 shadow-card transition-all hover:border-foreground/20 has-checked:border-foreground has-checked:ring-1 has-checked:ring-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50 sm:p-5">
      <input type="radio" name="format" value={f.id} defaultChecked={defaultChecked} className="sr-only" aria-label={`${f.label}: ${totalQuestions(f)} questions, ${duration(totalSeconds(f))}`} />
      <span className="flex items-baseline justify-between gap-3">
        <span className="font-semibold">{f.label}</span>
        <span className="text-xs text-muted-foreground">{f.id === "full" ? "Same as NEET PG 2026" : "Same pace, quarter length"}</span>
      </span>
      <span className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">{totalQuestions(f)}</span>
        <span className="text-sm text-muted-foreground">questions · {duration(totalSeconds(f))}</span>
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {f.sectionCount} sections × {f.sectionSize} questions · {Number.isInteger(perSection) ? perSection : perSection.toFixed(1)} min each
      </span>
    </label>
  );
}

const RULES = [
  { Icon: Layers, text: "Questions from every subject, mixed across 5 sections, roughly in NEET PG proportions." },
  { Icon: Clock, text: "Each section has its own timer. When it ends, the next section starts automatically." },
  { Icon: Lock, text: "A closed section can't be reopened, and you can't move ahead early, just like the real exam." },
  { Icon: Flag, text: "Mark questions for review. Marked questions with an answer are scored; without an answer they score 0." },
  { Icon: CircleAlert, text: "Answers are shown only at the end. The timer keeps running if you leave the page." },
];

async function Mocks() {
  await connection();
  const userId = await requireUserId("/mock");
  await finalizeExpiredMocks(userId);
  const mocks = await listMocks(userId);
  const now = new Date();
  const running = mocks.find((m) => !m.endedAt);

  return (
    <div className="flex flex-col gap-8">
      {running && (
        <Link
          href={`/mock/${running.id}`}
          data-testid="resume-mock"
          className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-card p-4 shadow-card hover:shadow-float sm:p-5"
        >
          <PlayCircle className="size-6 shrink-0 text-brand" aria-hidden />
          <span className="flex-1">
            <span className="block font-semibold">You have a mock in progress</span>
            <span className="block text-sm text-muted-foreground">
              {(() => {
                const c = mockClock(running.startedAt, { sectionCount: running.sectionCount, sectionSeconds: running.sectionSeconds }, now);
                return c.state === "running" ? `Section ${c.section + 1} of ${running.sectionCount} is open. The clock is running.` : "Time is up.";
              })()}
            </span>
          </span>
          <span className="rounded-full bg-foreground px-3 py-1.5 text-sm font-medium text-background">Resume</span>
        </Link>
      )}

      <form action={startMock} className="flex flex-col gap-5">
        <fieldset className="grid gap-2.5 sm:grid-cols-2">
          <legend className="mb-3 text-sm font-medium">Choose a format</legend>
          <FormatOption f={MOCK_FORMATS.full} defaultChecked />
          <FormatOption f={MOCK_FORMATS.mini} />
        </fieldset>

        <section className="rounded-2xl border bg-card p-5 shadow-card sm:p-6" aria-labelledby="rules-title">
          <h2 id="rules-title" className="text-sm font-medium">
            Exam rules
          </h2>
          <ul className="mt-3 grid gap-2.5 text-sm text-muted-foreground">
            {RULES.map(({ Icon, text }) => (
              <li key={text} className="flex gap-2.5">
                <Icon className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Marking: <span className="font-medium text-foreground tabular-nums">+4</span> correct ·{" "}
            <span className="font-medium text-foreground tabular-nums">−1</span> wrong ·{" "}
            <span className="font-medium text-foreground tabular-nums">0</span> not answered. Your answers also feed your review queue.
          </p>
          <div className="mt-5">
            {running ? (
              <p className="text-sm text-muted-foreground">Submit the mock in progress (or let its time run out) to start another.</p>
            ) : (
              <StartButton label="Start mock" className="w-full sm:w-auto sm:min-w-48" />
            )}
          </div>
        </section>
      </form>

      {mocks.some((m) => m.endedAt) && (
        <section aria-labelledby="past-title">
          <h2 id="past-title" className="mb-3 text-sm font-medium">
            Your mocks
          </h2>
          <ul className="divide-y rounded-2xl border bg-card shadow-card" data-testid="past-mocks">
            {mocks
              .filter((m) => m.endedAt)
              .map((m) => {
                const f = formatOf(m.format);
                const acc = m.correct + m.wrong > 0 ? m.correct / (m.correct + m.wrong) : null;
                return (
                  <li key={m.id}>
                    <Link href={`/mock/${m.id}/result`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 sm:px-5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{f.label}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {when.format(m.startedAt)} · {m.correct + m.wrong}/{m.questionCount} answered · {formatPercent(acc)} accuracy
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">/ {m.questionCount * 4}</span>
                      <ScorePill value={m.score} />
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function MockPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Mock test</h1>
        <p className="mt-1.5 max-w-2xl text-muted-foreground">
          A timed exam in the NEET PG 2026 pattern. Answers and your analysis appear when you submit or time runs out.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex flex-col gap-5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Skeleton className="h-[136px] rounded-xl" />
              <Skeleton className="h-[136px] rounded-xl" />
            </div>
            <Skeleton className="h-[280px] rounded-2xl" />
          </div>
        }
      >
        <Mocks />
      </Suspense>
    </div>
  );
}
