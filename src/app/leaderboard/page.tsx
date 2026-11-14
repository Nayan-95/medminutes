import { ArrowRight, Crosshair, EyeOff, Flame, Medal, TrendingUp, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { subjectLabel } from "@/components/subject-icon";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUserId } from "@/lib/current-user";
import { formatPercent, formatScore } from "@/lib/format";
import { accuracy, shortName, type Ranked, type Window } from "@/lib/leaderboard";
import { getLeaderboard, type Leaderboard } from "@/lib/leaderboard-data";
import { listSubjects } from "@/lib/practice";
import { cn } from "@/lib/utils";

import { setLeaderboardHidden } from "./actions";
import { SubjectFilter } from "./subject-filter";

export const metadata: Metadata = { title: "Leaderboard — MedMinutes" };

function Section({ title, subtitle, icon: Icon, children, className, testId }: {
  title: string;
  subtitle?: string;
  icon: typeof Trophy;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card shadow-card", className)} data-testid={testId}>
      <div className="border-b px-5 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 font-semibold tracking-tight">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

function Person({ name, email, isMe }: { name: string | null; email: string | null; isMe: boolean }) {
  return (
    <span className="block min-w-0">
      <span className="flex items-center gap-1.5 text-sm font-medium">
        <span className="truncate">{shortName(name, email)}</span>
        {isMe && <span className="shrink-0 rounded-full bg-foreground px-1.5 py-px text-[10px] font-semibold text-background">You</span>}
      </span>
      {email && <span className="block truncate text-xs text-muted-foreground">{email}</span>}
    </span>
  );
}

function Tile({ label, value, note, icon: Icon, testId }: { label: string; value: React.ReactNode; note?: React.ReactNode; icon: typeof Trophy; testId: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card sm:p-5" data-testid={testId}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl" data-slot="value">
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

function ScoreRow({ r, meId }: { r: Ranked; meId: string }) {
  const isMe = r.userId === meId;
  return (
    <tr className={cn("border-b last:border-0", isMe && "bg-muted/70")} data-testid={isMe ? "my-row" : undefined}>
      <td className="py-2.5 pl-2 text-sm font-semibold tabular-nums sm:pl-3">
        {r.rank <= 3 ? (
          <span className="inline-flex items-center gap-1">
            <Medal className={cn("size-4", r.rank === 1 ? "text-amber-500" : r.rank === 2 ? "text-zinc-400" : "text-orange-700")} aria-hidden />
            {r.rank}
          </span>
        ) : (
          r.rank
        )}
      </td>
      <td className="max-w-0 py-2.5 pr-2 pl-1">
        <Person name={r.name} email={r.email} isMe={isMe} />
      </td>
      <td className="hidden py-2.5 pr-3 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">{formatPercent(accuracy(r))}</td>
      <td className="hidden py-2.5 pr-3 text-right text-sm tabular-nums text-muted-foreground md:table-cell">{r.answered.toLocaleString("en-IN")}</td>
      <td className="hidden py-2.5 pr-3 text-right text-sm tabular-nums text-muted-foreground sm:table-cell">
        {r.streak > 0 ? (
          <span className="inline-flex items-center gap-0.5" title={`${r.streak}-day streak`}>
            <Flame className="size-3.5" aria-hidden />
            {r.streak}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="py-2.5 pr-2 text-right text-sm font-semibold tabular-nums sm:pr-3">{formatScore(r.score)}</td>
    </tr>
  );
}

function windowHref(window: Window, subjectId: number | null) {
  const params = new URLSearchParams({ window });
  if (subjectId !== null) params.set("subject", String(subjectId));
  return `/leaderboard?${params}`;
}

function Board({ data, window, subjectName }: { data: Leaderboard; window: Window; subjectName: string | null }) {
  const s = data.standing;
  const scope = `${window === "week" ? "this week" : "all time"}${subjectName ? ` in ${subjectName}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Your standing */}
      {s ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="standing">
          <Tile icon={Trophy} label="Your rank" testId="tile-rank" value={`#${s.rank}`} note={`of ${s.of.toLocaleString("en-IN")} ${s.of === 1 ? "aspirant" : "aspirants"}`} />
          <Tile
            icon={Users}
            label="Ahead of"
            testId="tile-percentile"
            value={s.aheadOf === null ? "—" : formatPercent(s.aheadOf)}
            note={s.aheadOf === null ? "No one else yet" : "of other aspirants"}
          />
          <Tile
            icon={TrendingUp}
            label="Next to pass"
            testId="tile-next"
            value={s.next ? `${s.next.gap} pts` : "You lead"}
            note={s.next ? `to pass ${shortName(s.next.row.name, s.next.row.email)}` : `Top score ${scope}`}
          />
          <Tile
            icon={Flame}
            label="Your streak"
            testId="tile-streak"
            value={(() => {
              const me = data.top.find((r) => r.userId === data.me.id) ?? data.meOutsideTop;
              return `${me?.streak ?? 0} ${me?.streak === 1 ? "day" : "days"}`;
            })()}
            note="Practise daily to keep it"
          />
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between" data-testid="not-ranked">
          <p className="text-sm text-muted-foreground">
            You haven&apos;t answered any questions {scope} yet. Answer one to get on the board.
          </p>
          <Link href="/practice" className={buttonVariants({ size: "lg" })}>
            Start practising
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        {/* Top scores */}
        <Section icon={Trophy} title="Top scores" subtitle={`Total marks ${scope}: +4 correct, −1 wrong, 0 skipped.`} testId="top-scores">
          {data.top.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No one has practised {scope} yet. Be the first.</p>
          ) : (
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th scope="col" className="w-14 pb-2 pl-2 font-medium sm:pl-3">#</th>
                  <th scope="col" className="pb-2 font-medium">Aspirant</th>
                  <th scope="col" className="hidden w-20 pb-2 pr-3 text-right font-medium sm:table-cell">Accuracy</th>
                  <th scope="col" className="hidden w-20 pb-2 pr-3 text-right font-medium md:table-cell">Answered</th>
                  <th scope="col" className="hidden w-16 pb-2 pr-3 text-right font-medium sm:table-cell">Streak</th>
                  <th scope="col" className="w-16 pb-2 pr-2 text-right font-medium sm:pr-3">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.top.map((r) => (
                  <ScoreRow key={r.userId} r={r} meId={data.me.id} />
                ))}
                {data.meOutsideTop && (
                  <>
                    <tr aria-hidden>
                      <td colSpan={6} className="py-1 text-center text-xs text-muted-foreground">⋯</td>
                    </tr>
                    <ScoreRow r={data.meOutsideTop} meId={data.me.id} />
                  </>
                )}
              </tbody>
            </table>
          )}
        </Section>

        <div className="flex flex-col gap-6">
          {/* Around you */}
          {s && s.neighbours.length > 1 && (
            <Section icon={Users} title="Around you" subtitle={s.next ? `${s.next.gap} points to move up a place.` : "You're at the top. Hold on to it."} testId="around-you">
              <ol className="flex flex-col">
                {s.neighbours.map((r) => {
                  const isMe = r.userId === data.me.id;
                  const myScore = s.neighbours.find((n) => n.userId === data.me.id)!.score;
                  const diff = r.score - myScore;
                  return (
                    <li key={r.userId} className={cn("flex items-center gap-3 rounded-lg px-2 py-2", isMe && "bg-muted/70")}>
                      <span className="w-7 text-sm font-semibold tabular-nums">{r.rank}</span>
                      <span className="min-w-0 flex-1">
                        <Person name={r.name} email={r.email} isMe={isMe} />
                      </span>
                      <span className="text-right text-sm tabular-nums">
                        <span className="font-semibold">{formatScore(r.score)}</span>
                        {!isMe && <span className="block text-xs text-muted-foreground">{diff === 0 ? "level" : `${formatScore(diff)} vs you`}</span>}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Section>
          )}

          {/* Most accurate */}
          <Section icon={Crosshair} title="Most accurate" subtitle={`Min. ${data.minForAccuracy} answers ${scope}. Careful beats fast.`} testId="most-accurate">
            {data.accuracy.length === 0 ? (
              <p className="px-2 py-1 text-sm text-muted-foreground">No one has {data.minForAccuracy}+ answers {scope} yet.</p>
            ) : (
              <ol className="flex flex-col">
                {data.accuracy.map((r, i) => (
                  <li key={r.userId} className={cn("flex items-center gap-3 rounded-lg px-2 py-2", r.userId === data.me.id && "bg-muted/70")}>
                    <span className="w-7 text-sm font-semibold tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <Person name={r.name} email={r.email} isMe={r.userId === data.me.id} />
                    </span>
                    <span className="text-right text-sm tabular-nums">
                      <span className="font-semibold">{formatPercent(r.accuracy)}</span>
                      <span className="block text-xs text-muted-foreground">{r.correct + r.wrong} answers</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {/* Most improved */}
          <Section icon={TrendingUp} title="Most improved this week" subtitle="Accuracy this week versus before it (20+ answers in each)." testId="most-improved">
            {data.improved.length === 0 ? (
              <p className="px-2 py-1 text-sm text-muted-foreground">No improvers yet this week. It could be you.</p>
            ) : (
              <ol className="flex flex-col">
                {data.improved.map((i, n) => (
                  <li key={i.row.userId} className={cn("flex items-center gap-3 rounded-lg px-2 py-2", i.row.userId === data.me.id && "bg-muted/70")}>
                    <span className="w-7 text-sm font-semibold tabular-nums">{n + 1}</span>
                    <span className="min-w-0 flex-1">
                      <Person name={i.row.name} email={i.row.email} isMe={i.row.userId === data.me.id} />
                    </span>
                    <span className="text-right text-sm tabular-nums">
                      <span className="font-semibold">+{Math.round(i.delta * 100)}%</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatPercent(i.before)} → {formatPercent(i.after)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      </div>

      {/* Visibility */}
      <form action={setLeaderboardHidden} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card sm:flex-row sm:items-center sm:justify-between" data-testid="visibility">
        <input type="hidden" name="hidden" value={data.me.hidden ? "false" : "true"} />
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <EyeOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          {data.me.hidden ? (
            <span>
              <span className="font-medium text-foreground">You&apos;re hidden.</span> Others can&apos;t see you; you still see your own rank.
            </span>
          ) : (
            <span>
              Others see you as <span className="font-medium text-foreground">{shortName(data.me.name, data.me.email)}</span> with your email
              {data.me.email ? <> ({data.me.email})</> : null}.
            </span>
          )}
        </p>
        <button type="submit" className={buttonVariants({ variant: "outline", size: "lg" })}>
          {data.me.hidden ? "Show me on the leaderboard" : "Hide me from the leaderboard"}
        </button>
      </form>
    </div>
  );
}

async function LeaderboardContent({ searchParams }: { searchParams: PageProps<"/leaderboard">["searchParams"] }) {
  await connection();
  const userId = await requireUserId("/leaderboard");
  const sp = await searchParams;
  const window: Window = sp.window === "all" ? "all" : "week";
  const subjects = await listSubjects();
  const subjectParam = Number(Array.isArray(sp.subject) ? sp.subject[0] : sp.subject);
  const subject = subjects.find((s) => s.id === subjectParam) ?? null;
  const data = await getLeaderboard(userId, { window, subjectId: subject?.id ?? null });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" aria-label="Time window">
          {(["week", "all"] as const).map((w) => (
            <Link
              key={w}
              href={windowHref(w, subject?.id ?? null)}
              aria-current={w === window ? "page" : undefined}
              className={cn(
                "rounded-lg px-4 py-1.5 text-center text-sm font-medium text-muted-foreground transition-all",
                w === window && "bg-card text-foreground shadow-card",
              )}
            >
              {w === "week" ? "This week" : "All time"}
            </Link>
          ))}
        </nav>
        <SubjectFilter subjects={subjects.map((s) => ({ id: s.id, label: subjectLabel(s.name) }))} value={subject?.id ?? null} window={window} />
      </div>
      <Board data={data} window={window} subjectName={subject ? subjectLabel(subject.name) : null} />
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-full max-w-md rounded-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

export default function LeaderboardPage(props: PageProps<"/leaderboard">) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="mt-1.5 text-muted-foreground">Real NEET PG marking. The weekly board resets every Monday at midnight IST.</p>
      </div>
      <Suspense fallback={<LeaderboardSkeleton />}>
        <LeaderboardContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
