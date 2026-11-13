import { ArrowRight, CircleCheck, Flame, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { ScorePill } from "@/components/score-pill";
import { SubjectIcon, subjectLabel } from "@/components/subject-icon";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserId } from "@/lib/current-user";
import { formatPercent, formatScore } from "@/lib/format";
import { getProgress, MIN_ATTEMPTED_TO_RANK } from "@/lib/progress";
import { getReviewStatus } from "@/lib/practice";
import { ReviewBanner } from "@/components/review-banner";
import { APP_TIME_ZONE } from "@/lib/streak";
import { cn } from "@/lib/utils";

import { startSession } from "../practice/actions";
import { StartButton } from "../practice/start-button";
import { ScoreTrend } from "./score-trend";

const when = new Intl.DateTimeFormat("en-IN", {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

function Tile({
  label,
  value,
  note,
  icon: Icon,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  icon: typeof Target;
  testId: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card sm:p-5" data-testid={testId}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums" data-slot="value">
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function Section({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card shadow-card", className)}>
      <div className="border-b px-5 py-4 sm:px-6">
        <h2 className="font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

async function Dashboard() {
  await connection();
  const userId = await requireUserId("/progress");
  const [p, review] = await Promise.all([getProgress(userId), getReviewStatus(userId)]);
  const o = p.overview;

  if (o.attempted + o.skipped === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-6 py-16 text-center shadow-card">
        <span className="grid size-12 place-items-center rounded-xl bg-muted">
          <Target className="size-6 text-brand" aria-hidden />
        </span>
        <h2 className="text-xl font-semibold tracking-tight">No practice yet</h2>
        <p className="max-w-sm text-muted-foreground">
          Finish a session and your accuracy by subject, weak topics and score trend will show up here.
        </p>
        <Link href="/practice" className={buttonVariants({ size: "xl" })}>
          Start your first session
          <ArrowRight data-icon="inline-end" />
        </Link>
      </div>
    );
  }

  const ranked = p.subjects.filter((s) => s.attempted >= MIN_ATTEMPTED_TO_RANK);
  const unranked = p.subjects.filter((s) => s.attempted < MIN_ATTEMPTED_TO_RANK);

  return (
    <div className="flex flex-col gap-6">
      <ReviewBanner {...review} now={new Date()} />
      {/* Headline tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Total score" value={formatScore(o.points)} note={`${o.completedSessions} sessions completed`} icon={Trophy} testId="tile-total" />
        <Tile label="Attempted" value={o.attempted.toLocaleString("en-IN")} note={`${o.skipped} skipped`} icon={CircleCheck} testId="tile-attempted" />
        <Tile label="Accuracy" value={formatPercent(o.accuracy)} note={`${o.correct} correct · ${o.wrong} wrong`} icon={Target} testId="tile-accuracy" />
        <Tile
          label="Streak"
          value={`${o.streak.current} ${o.streak.current === 1 ? "day" : "days"}`}
          note={o.streak.practisedToday ? `Best ${o.streak.best} · done today` : o.streak.current > 0 ? `Best ${o.streak.best} · practise today to keep it` : `Best ${o.streak.best}`}
          icon={Flame}
          testId="tile-streak"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        {/* Subjects: meter list, weakest first */}
        <Section title="Accuracy by subject" subtitle="Weakest first. Correct ÷ attempted; skips don't count.">
          <ul className="flex flex-col gap-3.5" data-testid="subject-list">
            {ranked.map((s) => (
              <li key={s.subjectId} className="grid grid-cols-[minmax(0,9.5rem)_1fr_auto] items-center gap-3 text-sm" data-testid={`subject-${s.name}`}>
                <span className="flex min-w-0 items-center gap-2">
                  <SubjectIcon name={s.name} className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{subjectLabel(s.name)}</span>
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-r-[4px] bg-correct" style={{ width: `${Math.round((s.accuracy ?? 0) * 100)}%` }} />
                </span>
                <span className="w-24 text-right tabular-nums">
                  <span className="font-semibold">{formatPercent(s.accuracy)}</span>
                  <span className="text-muted-foreground"> · {s.correct}/{s.attempted}</span>
                </span>
              </li>
            ))}
          </ul>
          {unranked.length > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              Needs {MIN_ATTEMPTED_TO_RANK}+ answers to rank:{" "}
              {unranked.map((s) => `${subjectLabel(s.name)} (${s.correct}/${s.attempted})`).join(" · ")}
            </p>
          )}
        </Section>

        {/* Weak topics */}
        <Section title="Weak topics" subtitle="Most wrong answers. Practise one to close the gap.">
          {p.weakTopics.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wrong answers yet. Nice.</p>
          ) : (
            <ul className="flex flex-col divide-y" data-testid="weak-topics">
              {p.weakTopics.map((t) => (
                <li key={t.topicId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.topic}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {subjectLabel(t.subject)} · {t.wrong} wrong · {formatPercent(t.accuracy)}
                    </span>
                  </span>
                  <form action={startSession}>
                    <input type="hidden" name="kind" value="practice" />
                    <input type="hidden" name="subjectId" value="all" />
                    <input type="hidden" name="topicId" value={t.topicId} />
                    <input type="hidden" name="count" value={10} />
                    <StartButton label="Practise" className="h-9 rounded-lg px-3 text-sm" />
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Score trend */}
      {p.trend.length > 0 && (
        <Section title="Score per session" subtitle={`Your last ${p.trend.length} completed sessions. Above the line is a net gain.`}>
          <ScoreTrend
            points={p.trend.map((s) => ({
              id: s.id,
              label: when.format(s.startedAt),
              subject: s.topic ? `${subjectLabel(s.subject ?? "")} · ${s.topic}` : s.subject ? subjectLabel(s.subject) : "All subjects",
              points: s.points,
              correct: s.correct,
              wrong: s.wrong,
              questionCount: s.questionCount,
            }))}
          />
        </Section>
      )}

      {/* Recent sessions: also the table view of the chart */}
      <Section title="Recent sessions">
        <ul className="-my-3 flex flex-col divide-y" data-testid="recent-sessions">
          {p.recent.map((s) => {
            const done = s.endedAt !== null;
            const name = s.topic ? `${subjectLabel(s.subject ?? "")} · ${s.topic}` : s.subject ? subjectLabel(s.subject) : "All subjects";
            return (
              <li key={s.id}>
                <Link
                  href={done ? `/practice/${s.id}/summary` : `/practice/${s.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted/50"
                >
                  <SubjectIcon name={s.subject} className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{name}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {when.format(s.startedAt)} · {s.answered}/{s.questionCount} answered
                      {s.correct + s.wrong > 0 && ` · ${formatPercent(s.correct / (s.correct + s.wrong))}`}
                    </span>
                  </span>
                  {done ? (
                    <ScorePill value={s.points} />
                  ) : (
                    <span className="rounded-full border px-2.5 py-1 text-xs font-medium">Continue</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading progress">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[112px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

export default function ProgressPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your progress</h1>
          <p className="mt-1.5 text-muted-foreground">Where you stand, and what to practise next.</p>
        </div>
        <Link href="/practice" className={buttonVariants({ size: "lg" })}>
          New session
          <ArrowRight data-icon="inline-end" />
        </Link>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
    </div>
  );
}
