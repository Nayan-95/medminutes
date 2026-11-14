import { and, eq, lte, sql, type SQL } from "drizzle-orm";
import { cacheLife } from "next/cache";

import { getDb } from "@/db";
import { attempts, questions, reviewCards } from "@/db/schema";
import {
  closestToTarget,
  interleave,
  pickCoverageUnits,
  pickWeakUnits,
  planSlots,
  predictSuccess,
  SMART_MIX,
  unitBeliefs,
  unitKey,
  type Pick,
  type Slot,
  type UnitStats,
} from "@/lib/recommend";
import { FORGETTING_CURVE } from "@/lib/srs";

/** What the user chose on the practice page; null means "all". */
export interface Scope {
  subjectId: number | null;
  topicId: number | null;
}

/** Postgres int[] literal ("{1,2,NULL}") — values are always integers from our own queries. */
const intArray = (xs: readonly (number | null)[]) => `{${xs.map((x) => (x === null ? "NULL" : Math.trunc(x))).join(",")}}`;

const inScope = (scope: Scope): SQL | undefined =>
  scope.topicId !== null
    ? eq(questions.topicId, scope.topicId)
    : scope.subjectId !== null
      ? eq(questions.subjectId, scope.subjectId)
      : undefined;

/** FSRS-6 retrievability of a card right now, in SQL (mirrors `retrievability()` in srs.ts). */
export function retrievabilitySql(now: Date): SQL<number> {
  const { factor, decay } = FORGETTING_CURVE;
  return sql<number>`coalesce(power(1 + ${factor}::float8 * greatest(extract(epoch from (${now.toISOString()}::timestamptz - ${reviewCards.lastReview})) / 86400.0, 0) / ${reviewCards.stability}, ${decay}::float8), 0)`;
}

/**
 * Due review cards, the ones you're most likely to have forgotten first
 * (lowest retrievability), optionally limited to a subject/topic.
 */
export async function drawDueCards(userId: string, count: number, scope: Scope = { subjectId: null, topicId: null }) {
  const now = new Date();
  const r = retrievabilitySql(now);
  return getDb()
    .select({ questionId: reviewCards.questionId, subjectId: questions.subjectId, topicId: questions.topicId, r })
    .from(reviewCards)
    .innerJoin(questions, eq(questions.id, reviewCards.questionId))
    .where(and(eq(reviewCards.userId, userId), lte(reviewCards.due, now), inScope(scope)))
    .orderBy(r)
    .limit(count);
}

/** Every unit (subject × topic, or a subject's untagged questions) with its size. Changes only on re-import. */
export async function listUnits(): Promise<{ subjectId: number; topicId: number | null; total: number }[]> {
  "use cache";
  cacheLife("days");
  return getDb()
    .select({ subjectId: questions.subjectId, topicId: questions.topicId, total: sql<number>`count(*)::int` })
    .from(questions)
    .groupBy(questions.subjectId, questions.topicId);
}

/** The user's FIRST answer to each question, counted per unit. Skips count as wrong. */
export async function getUserUnitStats(userId: string): Promise<Map<string, { seen: number; correct: number }>> {
  const { rows } = await getDb().execute<{ subject_id: number; topic_id: number | null; seen: number; correct: number }>(sql`
    select q.subject_id, q.topic_id, count(*)::int as seen,
           count(*) filter (where f.result = 'correct')::int as correct
      from (select distinct on (question_id) question_id, result
              from attempts where user_id = ${userId}
             order by question_id, created_at, id) f
      join questions q on q.id = f.question_id
     group by q.subject_id, q.topic_id`);
  return new Map(rows.map((r) => [unitKey(r.subject_id, r.topic_id), { seen: r.seen, correct: r.correct }]));
}

/** All units with this user's stats merged in. */
export async function getUnitStats(userId: string): Promise<UnitStats[]> {
  const [units, stats] = await Promise.all([listUnits(), getUserUnitStats(userId)]);
  return units.map((u) => {
    const key = unitKey(u.subjectId, u.topicId);
    const s = stats.get(key);
    return { key, subjectId: u.subjectId, topicId: u.topicId, total: u.total, seen: s?.seen ?? 0, correct: s?.correct ?? 0 };
  });
}

/** Up to `limit` random questions per unit that this user has never answered, with everyone's % correct on each. */
async function unseenCandidates(userId: string, wanted: { unit: UnitStats; limit: number }[]) {
  if (wanted.length === 0) return [];
  const { rows } = await getDb().execute<{ idx: string; id: number; correct: number; answered: number }>(sql`
    select u.idx, c0.id, c.correct, c.answered
      from unnest(${intArray(wanted.map((w) => w.unit.subjectId))}::int[],
                  ${intArray(wanted.map((w) => w.unit.topicId))}::int[],
                  ${intArray(wanted.map((w) => w.limit))}::int[]) with ordinality as u(subject_id, topic_id, lim, idx)
      cross join lateral (
        select q.id from questions q
         where q.subject_id = u.subject_id
           and (q.topic_id = u.topic_id or (u.topic_id is null and q.topic_id is null))
           and not exists (select 1 from attempts a where a.user_id = ${userId} and a.question_id = q.id)
         order by random() limit u.lim) c0
      cross join lateral (
        select count(*) filter (where a.result = 'correct')::int as correct, count(*)::int as answered
          from attempts a where a.question_id = c0.id) c`);
  return rows.map((r) => ({ unit: wanted[Number(r.idx) - 1].unit, id: r.id, item: { correct: r.correct, answered: r.answered } }));
}

/** Random questions in scope, excluding `exclude`; `unseenOnly` skips anything the user has answered. */
async function randomQuestions(userId: string, scope: Scope, n: number, exclude: readonly number[], unseenOnly: boolean) {
  if (n <= 0) return [];
  return getDb()
    .select({ id: questions.id, subjectId: questions.subjectId, topicId: questions.topicId })
    .from(questions)
    .where(
      and(
        inScope(scope),
        sql`${questions.id} <> all(${intArray(exclude)}::int[])`,
        unseenOnly
          ? sql`not exists (select 1 from ${attempts} a where a.user_id = ${userId} and a.question_id = ${questions.id})`
          : undefined,
      ),
    )
    .orderBy(sql`random()`)
    .limit(n);
}

/**
 * Builds a practice session ("smart mix", docs/adr/0005):
 * due reviews (more when the backlog is large) → weak units (Thompson sampling)
 * → unseen units (coverage) → a few purely random questions; new questions are
 * chosen nearest the target success rate, then everything is interleaved.
 */
export async function drawSmartMix(userId: string, scope: Scope, count: number): Promise<{ ids: number[]; slots: Slot[] }> {
  const rng = Math.random;
  const [allUnits, due, dueTotal] = await Promise.all([
    getUnitStats(userId),
    drawDueCards(userId, Math.round(count * SMART_MIX.backlogReviewShare), scope),
    getDb()
      .select({ n: sql<number>`count(*)::int` })
      .from(reviewCards)
      .where(and(eq(reviewCards.userId, userId), lte(reviewCards.due, new Date())))
      .then((r) => r[0]?.n ?? 0),
  ]);

  // Beliefs use the user's whole history (so subject priors are right), then narrow to the scope.
  const beliefs = unitBeliefs(allUnits).filter(
    (u) => (scope.topicId === null || u.topicId === scope.topicId) && (scope.subjectId === null || u.subjectId === scope.subjectId),
  );
  const beliefByKey = new Map(beliefs.map((b) => [b.key, b]));
  const plan = planSlots(count, { inScope: due.length, total: dueTotal });

  const picks: Pick[] = due
    .slice(0, plan.review)
    .map((d) => ({ questionId: d.questionId, slot: "review" as const, unitKey: unitKey(d.subjectId, d.topicId), p: d.r }));

  const weak = pickWeakUnits(beliefs, plan.weak, rng);
  const weakPicked = [...weak.values()].reduce((n, k) => n + k, 0);
  const coverage = pickCoverageUnits(beliefs, plan.coverage + (plan.weak - weakPicked), rng, weak);

  // One candidate query for every chosen unit; pick those nearest the target success rate.
  const keys = [...new Set([...weak.keys(), ...coverage.keys()])];
  const wanted = keys.map((key) => ({
    unit: beliefByKey.get(key)!,
    weak: weak.get(key) ?? 0,
    coverage: coverage.get(key) ?? 0,
  }));
  const candidates = await unseenCandidates(
    userId,
    wanted.map((w) => ({ unit: w.unit, limit: (w.weak + w.coverage) * SMART_MIX.candidatesPerPick })),
  );
  for (const w of wanted) {
    const mean = beliefByKey.get(w.unit.key)!.mean;
    const scored = candidates
      .filter((c) => c.unit.key === w.unit.key)
      .map((c) => ({ questionId: c.id, unitKey: c.unit.key, p: predictSuccess(mean, c.item) }));
    const chosen = closestToTarget(scored, w.weak + w.coverage);
    chosen.forEach((c, i) => picks.push({ ...c, slot: i < w.weak ? "weak" : "coverage" }));
  }

  // Random slots, plus anything the units above couldn't supply.
  const unitP = (s: number, t: number | null) => beliefByKey.get(unitKey(s, t))?.mean ?? SMART_MIX.targetSuccess;
  const randomRows = await randomQuestions(userId, scope, count - picks.length, picks.map((p) => p.questionId), true);
  for (const r of randomRows) picks.push({ questionId: r.id, slot: "random", unitKey: unitKey(r.subjectId, r.topicId), p: unitP(r.subjectId, r.topicId) });

  // Small topics can run out of unseen questions: top up with ones answered before.
  const fill = await randomQuestions(userId, scope, count - picks.length, picks.map((p) => p.questionId), false);
  for (const r of fill) picks.push({ questionId: r.id, slot: "fill", unitKey: unitKey(r.subjectId, r.topicId), p: unitP(r.subjectId, r.topicId) });

  const ordered = interleave(picks, rng);
  return { ids: ordered.map((p) => p.questionId), slots: ordered.map((p) => p.slot) };
}
