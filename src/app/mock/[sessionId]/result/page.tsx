import { ChevronRight, CircleCheck, CircleDashed, CircleMinus, CircleX, Clock, Flag, Repeat, Target, TrendingDown, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { ReportQuestion } from "@/components/report-question";
import { SubjectIcon, subjectLabel } from "@/components/subject-icon";
import { AskDoubt } from "@/components/ask-doubt";
import { WhyWrong } from "@/components/why-wrong";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserId } from "@/lib/current-user";
import { formatDuration, formatPercent, formatScore } from "@/lib/format";
import { accuracyOf, outcomeOf, totalSeconds, type MockAnalysis, type Outcome } from "@/lib/mock";
import { formatOf, getMockResult, type MockResultQuestion } from "@/lib/mock-data";
import { getOpenReportIdsForSession } from "@/lib/reports-data";
import { OPTIONS } from "@/lib/scoring";
import { cn } from "@/lib/utils";

const OUTCOME: Record<Outcome, { label: string; Icon: typeof CircleCheck; swatch: string; icon: string }> = {
  correct: { label: "Correct", Icon: CircleCheck, swatch: "bg-correct", icon: "text-correct" },
  wrong: { label: "Wrong", Icon: CircleX, swatch: "bg-wrong", icon: "text-wrong" },
  skipped: { label: "Not answered", Icon: CircleMinus, swatch: "bg-skipped", icon: "text-muted-foreground" },
  "not-visited": { label: "Not visited", Icon: CircleDashed, swatch: "bg-border", icon: "text-muted-foreground" },
};

const FILTERS = {
  all: { label: "All", test: () => true },
  wrong: { label: "Wrong", test: (q: MockResultQuestion) => outcomeOf(q) === "wrong" },
  unanswered: { label: "Not answered", test: (q: MockResultQuestion) => !q.response?.selectedOption },
  marked: { label: "Marked", test: (q: MockResultQuestion) => !!q.response?.markedForReview },
  changed: {
    label: "Changed",
    test: (q: MockResultQuestion) => !!q.response?.firstOption && !!q.response.selectedOption && q.response.firstOption !== q.response.selectedOption,
  },
} as const;
type Filter = keyof typeof FILTERS;

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function Insight({ Icon, title, children, testId }: { Icon: typeof Flag; title: string; children: React.ReactNode; testId?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card" data-testid={testId}>
      <p className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        {title}
      </p>
      <div className="mt-1.5 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function SubjectRow({ s }: { s: MockAnalysis["subjects"][number] }) {
  const acc = accuracyOf(s);
  return (
    <li className="flex items-center gap-3 px-5 py-2.5 sm:px-6">
      <SubjectIcon name={s.subject} className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{subjectLabel(s.subject)}</span>
        <span className="block text-xs text-muted-foreground tabular-nums">
          {s.correct} correct · {s.wrong} wrong · {s.skipped + s.notVisited} not answered
        </span>
      </span>
      <span className="hidden w-24 sm:block" aria-hidden>
        <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${Math.round((acc ?? 0) * 100)}%` }} />
        </span>
      </span>
      <span className="w-10 text-right text-sm tabular-nums">{formatPercent(acc)}</span>
      <span className="w-10 text-right text-sm font-semibold tabular-nums">{formatScore(s.score)}</span>
    </li>
  );
}

async function Result({ params, searchParams }: { params: PageProps<"/mock/[sessionId]/result">["params"]; searchParams: PageProps<"/mock/[sessionId]/result">["searchParams"] }) {
  await connection();
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) redirect("/mock");
  const userId = await requireUserId(`/mock/${sessionId}/result`);
  const [data, reportedIds] = await Promise.all([getMockResult(sessionId, userId), getOpenReportIdsForSession(userId, sessionId)]);
  if (!data) redirect("/mock");
  if (!data.submitted) redirect(`/mock/${sessionId}`);

  const show = (await searchParams).show;
  const filter: Filter = typeof show === "string" && show in FILTERS ? (show as Filter) : "all";
  const a = data.analysis;
  const f = formatOf(data.mock.format);
  const used = data.session.endedAt!.getTime() - data.session.startedAt.getTime();
  const notAnswered = a.skipped + a.notVisited;
  const shown = data.items.filter(FILTERS[filter].test);
  const answeredSubjects = a.subjects.filter((s) => s.correct + s.wrong > 0);
  const unansweredSubjects = a.subjects.filter((s) => s.correct + s.wrong === 0);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Hero */}
      <section className="animate-rise rounded-xl border bg-card p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium">{f.label}</span>
          <span>{when.format(data.session.startedAt)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden /> {formatDuration(used)} of {Math.round(totalSeconds(data.mock) / 60)} min
          </span>
        </div>
        <h1 className="sr-only">Mock result</h1>

        <div className="mt-6 grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="eyebrow">Score</p>
            <p className="mt-1 flex items-baseline gap-3" data-testid="mock-score">
              <span className="font-display text-7xl leading-none tabular-nums">{formatScore(a.score)}</span>
              <span className="text-muted-foreground tabular-nums">/ {a.max}</span>
            </p>
          </div>
          <div className="rounded-lg border bg-background/50 px-4 py-3 sm:text-right" data-testid="mock-percentile">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground sm:justify-end">
              <Trophy className="size-3.5" aria-hidden /> Percentile
            </p>
            {data.percentile === null ? (
              <p className="mt-1 max-w-52 text-xs text-muted-foreground">Shown once 10 other {f.label.toLowerCase()}s have been taken on MedMinutes.</p>
            ) : (
              <>
                <p className="text-2xl font-semibold tabular-nums">{Math.round(data.percentile * 100)}</p>
                <p className="text-xs text-muted-foreground">ahead of {formatPercent(data.percentile)} of {data.comparedWith} mocks</p>
              </>
            )}
          </div>
        </div>

        {a.max > 0 && (
          <div className="mt-6 flex h-2.5 gap-[2px]" role="img" aria-label={`${a.correct} correct, ${a.wrong} wrong, ${a.skipped} not answered, ${a.notVisited} not visited`}>
            {(["correct", "wrong", "skipped", "not-visited"] as const).map((k) => {
              const n = k === "not-visited" ? a.notVisited : a[k];
              return n > 0 ? <div key={k} className={cn("h-full rounded-[4px]", OUTCOME[k].swatch)} style={{ flexGrow: n }} /> : null;
            })}
          </div>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {(["correct", "wrong", "skipped", "not-visited"] as const).map((k) => {
            const o = OUTCOME[k];
            const n = k === "not-visited" ? a.notVisited : a[k];
            return (
              <div key={k} className="rounded-xl border bg-background/50 p-3" data-testid={`mock-count-${k}`}>
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("size-2 rounded-full", o.swatch)} aria-hidden />
                  <o.Icon className={cn("size-3.5", o.icon)} aria-hidden />
                  {o.label}
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{n}</dd>
              </div>
            );
          })}
        </dl>
        <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Target className="size-4" aria-hidden /> {formatPercent(a.accuracy)} accuracy on {a.correct + a.wrong} answered
        </p>
      </section>

      {/* Insights */}
      <section aria-labelledby="insights-title">
        <h2 id="insights-title" className="mb-3 font-semibold tracking-tight">
          What to learn from this mock
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Insight Icon={TrendingDown} title="Negative marking" testId="insight-negative">
            {a.wrong === 0 ? (
              "No marks lost to wrong answers."
            ) : (
              <>
                {a.wrong} wrong answers cost you <span className="font-medium text-foreground tabular-nums">{a.negativeMarks}</span> marks.
                {notAnswered > 0 && ` You left ${notAnswered} unanswered.`}
              </>
            )}
          </Insight>
          <Insight Icon={Repeat} title="Changed answers" testId="insight-changes">
            {a.changes.rightToWrong + a.changes.wrongToRight + a.changes.wrongToWrong === 0 ? (
              "You didn't change any answers."
            ) : (
              <>
                Right → wrong: <span className="font-medium text-foreground tabular-nums">{a.changes.rightToWrong}</span> · Wrong → right:{" "}
                <span className="font-medium text-foreground tabular-nums">{a.changes.wrongToRight}</span> · Wrong → wrong:{" "}
                <span className="font-medium text-foreground tabular-nums">{a.changes.wrongToWrong}</span>.{" "}
                {a.changes.rightToWrong > a.changes.wrongToRight ? "Your first instinct was better; change only with a clear reason." : "Your second looks helped."}
              </>
            )}
          </Insight>
          <Insight Icon={Flag} title="Marked for review" testId="insight-marked">
            {a.marked.answered + a.marked.unanswered === 0 ? (
              "You didn't mark any questions."
            ) : (
              <>
                {a.marked.answered} marked and answered, <span className="font-medium text-foreground tabular-nums">{a.marked.correct}</span> right (
                {formatPercent(a.marked.answered ? a.marked.correct / a.marked.answered : null)}).
                {a.marked.unanswered > 0 && ` ${a.marked.unanswered} marked but left unanswered (0 marks).`}
              </>
            )}
          </Insight>
          <Insight Icon={Clock} title="Pace" testId="insight-pace">
            {a.avgAnswerMs === null ? (
              "No answers to time."
            ) : (
              <>
                <span className="font-medium text-foreground tabular-nums">{Math.round(a.avgAnswerMs / 1000)} s</span> per answered question. The exam allows 70 s.
              </>
            )}
          </Insight>
        </div>
      </section>

      {/* Sections */}
      <section className="rounded-xl border bg-card shadow-card" aria-labelledby="sections-title">
        <h2 id="sections-title" className="border-b px-5 py-4 font-semibold tracking-tight sm:px-6">
          By section
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums" data-testid="section-table">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th scope="col" className="px-5 py-2.5 text-left font-medium sm:px-6">Section</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Correct</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Wrong</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  <span className="sm:hidden">Blank</span>
                  <span className="hidden sm:inline">Not answered</span>
                </th>
                <th scope="col" className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Time on questions</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium sm:px-6">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {a.sections.map((s) => (
                <tr key={s.section}>
                  <th scope="row" className="px-5 py-2.5 text-left font-medium sm:px-6">{s.section + 1}</th>
                  <td className="px-3 py-2.5 text-right">{s.correct}</td>
                  <td className="px-3 py-2.5 text-right">{s.wrong}</td>
                  <td className="px-3 py-2.5 text-right">{s.skipped + s.notVisited}</td>
                  <td className="hidden px-3 py-2.5 text-right text-muted-foreground sm:table-cell">{formatDuration(s.timeSpentMs)}</td>
                  <td className="px-5 py-2.5 text-right font-semibold sm:px-6">{formatScore(s.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Subjects */}
      <section className="rounded-xl border bg-card shadow-card" aria-labelledby="subjects-title">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 id="subjects-title" className="font-semibold tracking-tight">By subject</h2>
          <p className="text-xs text-muted-foreground">Weakest first. Practise these next.</p>
        </div>
        <ul className="divide-y" data-testid="subject-table">
          {answeredSubjects.map((s) => (
            <SubjectRow key={s.subject} s={s} />
          ))}
        </ul>
        {unansweredSubjects.length > 0 && (
          <details className="group border-t">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm text-muted-foreground hover:bg-muted/40 sm:px-6 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
              {unansweredSubjects.length} {unansweredSubjects.length === 1 ? "subject" : "subjects"} with no answers
            </summary>
            <ul className="divide-y border-t">
              {unansweredSubjects.map((s) => (
                <SubjectRow key={s.subject} s={s} />
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Review */}
      <section className="rounded-xl border bg-card shadow-card" aria-labelledby="review-title">
        <div className="flex flex-wrap items-center gap-3 border-b px-5 py-4 sm:px-6">
          <h2 id="review-title" className="font-semibold tracking-tight">Review answers</h2>
          <nav className="flex flex-wrap gap-1 sm:ml-auto" aria-label="Filter questions">
            {(Object.keys(FILTERS) as Filter[]).map((k) => (
              <Link
                key={k}
                href={k === "all" ? `/mock/${sessionId}/result#review-title` : `/mock/${sessionId}/result?show=${k}#review-title`}
                scroll={false}
                aria-current={k === filter ? "page" : undefined}
                className={cn("rounded-full px-2.5 py-1 text-xs font-medium tabular-nums", k === filter ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
              >
                {FILTERS[k].label} {data.items.filter(FILTERS[k].test).length}
              </Link>
            ))}
          </nav>
        </div>
        {shown.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground sm:px-6">No questions here.</p>
        ) : (
          <ol className="divide-y" data-testid="review-list">
            {shown.map((q) => {
              const o = OUTCOME[outcomeOf(q)];
              const r = q.response;
              return (
                <li key={q.questionId}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 hover:bg-muted/40 sm:px-6 [&::-webkit-details-marker]:hidden">
                      <o.Icon className={cn("mt-0.5 size-[18px] shrink-0", o.icon)} aria-label={o.label} />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm leading-relaxed">
                          <span className="text-muted-foreground tabular-nums">{q.index + 1}. </span>
                          {q.question}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                          <span>{subjectLabel(q.subject)}</span>·<span>{r?.selectedOption ? `You: ${r.selectedOption}` : o.label}</span>·<span>Answer: {q.correctOption}</span>
                          {r && r.firstOption && r.selectedOption && r.firstOption !== r.selectedOption && <>· <span>First picked {r.firstOption}</span></>}
                          {r?.markedForReview && (
                            <>
                              · <Flag className="size-3" aria-hidden /> <span>Marked</span>
                            </>
                          )}
                          {r && r.timeSpentMs > 0 && <>· <span className="tabular-nums">{formatDuration(r.timeSpentMs)}</span></>}
                        </span>
                      </span>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                    </summary>
                    <div className="px-5 pb-5 sm:px-6 sm:pl-[3.25rem]">
                      <ul className="grid gap-1.5 text-sm">
                        {OPTIONS.map((opt) => (
                          <li
                            key={opt}
                            className={cn(
                              "flex gap-2 rounded-lg px-3 py-2",
                              opt === q.correctOption && "bg-correct-soft",
                              opt === r?.selectedOption && opt !== q.correctOption && "bg-wrong-soft",
                            )}
                          >
                            <span className="font-semibold">{opt}.</span>
                            <span className="flex-1">{q.options[opt]}</span>
                            {opt === q.correctOption && <CircleCheck className="size-4 text-correct" aria-label="Correct answer" />}
                            {opt === r?.selectedOption && opt !== q.correctOption && <CircleX className="size-4 text-wrong" aria-label="Your answer" />}
                          </li>
                        ))}
                      </ul>
                      {q.explanation ? (
                        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                          <span className="font-medium text-foreground">Explanation · </span>
                          {q.explanation}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm text-muted-foreground">No explanation available for this question.</p>
                      )}
                      <div className="mt-4 flex flex-col items-start gap-3">
                        {outcomeOf(q) === "wrong" && <WhyWrong questionId={q.questionId} />}
                        <AskDoubt questionId={q.questionId} />
                      </div>
                      <ReportQuestion questionId={q.questionId} initiallyReported={reportedIds.includes(q.questionId)} className="mt-3" />
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Link href="/mock" className={cn(buttonVariants({ size: "xl" }), "w-full sm:w-auto")}>
          Back to mock tests
        </Link>
        <Link href="/practice" className={cn(buttonVariants({ variant: "outline", size: "xl" }), "w-full sm:w-auto")}>
          Practise weak subjects
        </Link>
      </div>
    </div>
  );
}

export default function MockResultPage(props: PageProps<"/mock/[sessionId]/result">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6" aria-label="Loading result">
          <Skeleton className="h-[380px] w-full rounded-xl" />
          <Skeleton className="h-[220px] w-full rounded-xl" />
        </div>
      }
    >
      <Result params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
