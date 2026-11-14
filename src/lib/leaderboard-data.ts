import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import {
  accuracyBoard,
  MIN_FOR_ACCURACY,
  mostImproved,
  rankByScore,
  standing,
  TOP_N,
  weekStart,
  type Row,
  type Window,
} from "@/lib/leaderboard";
import { APP_TIME_ZONE, computeStreak, dayKey } from "@/lib/streak";

type DbRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  days: string[] | null;
  all_score: number;
  all_correct: number;
  all_wrong: number;
  all_answered: number;
  week_score: number;
  week_correct: number;
  week_wrong: number;
  week_answered: number;
  before_correct: number;
  before_wrong: number;
};

/**
 * Everything the leaderboard page shows, from one query. Hidden users are left
 * out for everyone except themselves (docs/adr/0006).
 */
export async function getLeaderboard(meId: string, opts: { window: Window; subjectId: number | null }) {
  const now = new Date();
  const since = weekStart(now);
  const subjectJoin = opts.subjectId === null ? sql`` : sql`join questions q on q.id = a.question_id and q.subject_id = ${opts.subjectId}`;

  const [{ rows }, [me]] = await Promise.all([
    getDb().execute<DbRow>(sql`
      select u.id as user_id, u.name, u.email,
             (select array_agg(distinct to_char(a2.created_at at time zone ${APP_TIME_ZONE}, 'YYYY-MM-DD'))
                from attempts a2
               where a2.user_id = u.id and a2.created_at > now() - interval '400 days') as days,
             coalesce(sum(a.points), 0)::int as all_score,
             count(*) filter (where a.result = 'correct')::int as all_correct,
             count(*) filter (where a.result = 'wrong')::int as all_wrong,
             count(*)::int as all_answered,
             coalesce(sum(a.points) filter (where a.created_at >= ${since.toISOString()}::timestamptz), 0)::int as week_score,
             count(*) filter (where a.created_at >= ${since.toISOString()}::timestamptz and a.result = 'correct')::int as week_correct,
             count(*) filter (where a.created_at >= ${since.toISOString()}::timestamptz and a.result = 'wrong')::int as week_wrong,
             count(*) filter (where a.created_at >= ${since.toISOString()}::timestamptz)::int as week_answered,
             count(*) filter (where a.created_at < ${since.toISOString()}::timestamptz and a.result = 'correct')::int as before_correct,
             count(*) filter (where a.created_at < ${since.toISOString()}::timestamptz and a.result = 'wrong')::int as before_wrong
        from attempts a
        join users u on u.id = a.user_id
        ${subjectJoin}
       where (not u.leaderboard_hidden or u.id = ${meId})
       group by u.id`),
    getDb().select({ hidden: users.leaderboardHidden, name: users.name, email: users.email }).from(users).where(eq(users.id, meId)),
  ]);

  const today = dayKey(now);
  const toRow = (r: DbRow, w: Window): Row => ({
    userId: r.user_id,
    name: r.name,
    email: r.email,
    streak: computeStreak(r.days ?? [], today).current,
    score: w === "week" ? r.week_score : r.all_score,
    correct: w === "week" ? r.week_correct : r.all_correct,
    wrong: w === "week" ? r.week_wrong : r.all_wrong,
    answered: w === "week" ? r.week_answered : r.all_answered,
  });

  const windowRows = rows.map((r) => toRow(r, opts.window));
  const ranked = rankByScore(windowRows);
  const mine = standing(ranked, meId);
  const top = ranked.slice(0, TOP_N);
  const meOutsideTop = mine && mine.rank > TOP_N ? ranked.find((r) => r.userId === meId)! : null;

  return {
    weekStart: since,
    me: { id: meId, hidden: me?.hidden ?? false, name: me?.name ?? null, email: me?.email ?? null },
    total: ranked.length,
    top,
    meOutsideTop,
    standing: mine,
    accuracy: accuracyBoard(windowRows, opts.subjectId === null ? MIN_FOR_ACCURACY.all : MIN_FOR_ACCURACY.subject),
    minForAccuracy: opts.subjectId === null ? MIN_FOR_ACCURACY.all : MIN_FOR_ACCURACY.subject,
    improved: mostImproved(
      rows.map((r) => toRow(r, "week")),
      new Map(rows.map((r) => [r.user_id, { correct: r.before_correct, wrong: r.before_wrong }])),
    ),
  };
}

export type Leaderboard = Awaited<ReturnType<typeof getLeaderboard>>;
