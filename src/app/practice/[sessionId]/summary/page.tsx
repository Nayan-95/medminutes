import { ChevronRight, CircleCheck, CircleMinus, CircleX, Clock, Target } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { SubjectIcon, subjectLabel } from "@/components/subject-icon";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserId } from "@/lib/current-user";
import { formatDuration, formatPercent, formatScore } from "@/lib/format";
import { getSessionForUser } from "@/lib/practice";
import { MARKS, summarise, type AttemptResult } from "@/lib/scoring";
import { cn } from "@/lib/utils";

import { startSession } from "../../actions";
import { StartButton } from "../../start-button";

const PARTS: { key: AttemptResult; label: string; Icon: typeof CircleCheck; swatch: string; icon: string }[] = [
  { key: "correct", label: "Correct", Icon: CircleCheck, swatch: "bg-correct", icon: "text-correct" },
  { key: "wrong", label: "Wrong", Icon: CircleX, swatch: "bg-wrong", icon: "text-wrong" },
  { key: "skipped", label: "Skipped", Icon: CircleMinus, swatch: "bg-skipped", icon: "text-muted-foreground" },
];

function verdict(total: number, max: number) {
  const r = max > 0 ? total / max : 0;
  if (r >= 0.75) return "Excellent session.";
  if (r >= 0.5) return "Solid work.";
  if (r > 0) return "Good start. Review the misses below.";
  if (r === 0) return "Even. Review the misses below.";
  return "Negative marking bit this time. Skip when unsure.";
}

async function Summary({ params }: { params: PageProps<"/practice/[sessionId]/summary">["params"] }) {
  await connection();
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) redirect("/practice");

  const data = await getSessionForUser(sessionId, await requireUserId(`/practice/${sessionId}/summary`));
  // Missing, deleted or not yours: send to a fresh session instead of a dead-end 404.
  if (!data) redirect("/practice");

  const s = summarise(data.attempts.map((a) => a.result));
  const n = data.questions.length;
  const max = n * MARKS.correct;
  const unanswered = n - data.attempts.length;
  const elapsed = (data.session.endedAt ?? new Date()).getTime() - data.session.startedAt.getTime();
  const byQuestion = new Map(data.attempts.map((a) => [a.questionId, a]));
  const subjectName = data.session.subjectId === null ? null : (data.questions[0]?.subject ?? null);

  const counts: Record<AttemptResult, number> = { correct: s.correct, wrong: s.wrong, skipped: s.skipped };
  const points: Record<AttemptResult, number> = {
    correct: s.correct * MARKS.correct,
    wrong: s.wrong * MARKS.wrong,
    skipped: 0,
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {/* Hero */}
      <section className="animate-rise rounded-2xl border bg-card p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            <SubjectIcon name={subjectName} className="size-3.5" />
            {subjectName ? subjectLabel(subjectName) : "All subjects"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Clock className="size-3.5" aria-hidden /> {formatDuration(elapsed)}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Target className="size-3.5" aria-hidden /> {formatPercent(s.accuracy)} accuracy
          </span>
        </div>

        <h1 className="sr-only">Session complete</h1>
        <p className="mt-6 text-sm text-muted-foreground">Session score</p>
        <p className="mt-1 flex items-baseline gap-3" data-testid="summary-score">
          <span className="text-6xl font-semibold tracking-tight tabular-nums">{formatScore(s.total)}</span>
          <span className="text-muted-foreground tabular-nums">/ +{max}</span>
        </p>
        <p className="mt-2 font-medium">{verdict(s.total, max)}</p>

        {/* Thin segmented bar: the tiles below carry the figures and act as its legend. */}
        {n > 0 && (
          <div className="mt-6 flex h-2.5 gap-[2px]" role="img" aria-label={`${s.correct} correct, ${s.wrong} wrong, ${s.skipped + unanswered} skipped of ${n}`}>
            {PARTS.map((p) => {
              const count = counts[p.key] + (p.key === "skipped" ? unanswered : 0);
              return count > 0 ? (
                <div key={p.key} className={cn("h-full rounded-[4px]", p.swatch)} style={{ flexGrow: count }} />
              ) : null;
            })}
          </div>
        )}

        <dl className="mt-4 grid grid-cols-3 gap-2.5">
          {PARTS.map((p) => (
            <div key={p.key} className="rounded-xl border bg-background/50 p-3 sm:p-4" data-testid={`tile-${p.key}`}>
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-2 rounded-full", p.swatch)} aria-hidden />
                <p.Icon className={cn("size-3.5", p.icon)} aria-hidden />
                {p.label}
              </dt>
              <dd className="mt-1.5 text-2xl font-semibold tabular-nums" data-testid={`count-${p.key}`}>
                {counts[p.key]}
              </dd>
              <dd className="text-xs text-muted-foreground tabular-nums">{formatScore(points[p.key])} marks</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <form action={startSession} className="sm:flex-none">
            <input type="hidden" name="subjectId" value={data.session.subjectId ?? "all"} />
            <input type="hidden" name="count" value={data.session.questionCount} />
            <StartButton label="Practise again" className="w-full" />
          </form>
          <Link href="/practice" className={cn(buttonVariants({ variant: "outline", size: "xl" }), "w-full sm:w-auto")}>
            Change subject
          </Link>
        </div>
      </section>

      {/* Review */}
      <section className="rounded-2xl border bg-card shadow-card">
        <h2 className="border-b px-5 py-4 font-semibold tracking-tight sm:px-6">Review</h2>
        <ol className="divide-y">
          {data.questions.map((q, i) => {
            const a = byQuestion.get(q.id);
            const part = PARTS.find((p) => p.key === (a?.result ?? "skipped"))!;
            return (
              <li key={q.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 hover:bg-muted/40 sm:px-6 [&::-webkit-details-marker]:hidden">
                    <part.Icon className={cn("mt-0.5 size-[18px] shrink-0", part.icon)} aria-label={a ? part.label : "Not answered"} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm leading-relaxed">
                        <span className="text-muted-foreground tabular-nums">{i + 1}. </span>
                        {q.question}
                      </span>
                      {a && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {a.selectedOption ? `You: ${a.selectedOption}` : "Skipped"} · Answer: {a.correctOption} ·{" "}
                          {formatScore(a.points)}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                  </summary>
                  {a && (
                    <div className="px-5 pb-5 sm:px-6 sm:pl-[3.25rem]">
                      <ul className="grid gap-1.5 text-sm">
                        {(["A", "B", "C", "D"] as const).map((opt) => (
                          <li
                            key={opt}
                            className={cn(
                              "flex gap-2 rounded-lg px-3 py-2",
                              opt === a.correctOption && "bg-correct-soft",
                              opt === a.selectedOption && opt !== a.correctOption && "bg-wrong-soft",
                            )}
                          >
                            <span className="font-semibold">{opt}.</span>
                            <span className="flex-1">{q.options[opt]}</span>
                            {opt === a.correctOption && <CircleCheck className="size-4 text-correct" aria-label="Correct answer" />}
                            {opt === a.selectedOption && opt !== a.correctOption && (
                              <CircleX className="size-4 text-wrong" aria-label="Your answer" />
                            )}
                          </li>
                        ))}
                      </ul>
                      {a.explanation && (
                        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                          <span className="font-medium text-foreground">Explanation · </span>
                          {a.explanation}
                        </p>
                      )}
                    </div>
                  )}
                </details>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export default function SummaryPage(props: PageProps<"/practice/[sessionId]/summary">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" aria-label="Loading summary">
          <Skeleton className="h-[380px] w-full rounded-2xl" />
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        </div>
      }
    >
      <Summary params={props.params} />
    </Suspense>
  );
}
