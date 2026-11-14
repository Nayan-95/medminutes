import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { attempts, practiceSessions, questions, subjects, topics } from "@/db/schema";
import { SMART_MIX, unitBeliefs, unitKey } from "@/lib/recommend";
import { getUnitStats } from "@/lib/smart-mix";
import { APP_TIME_ZONE, computeStreak, dayKey } from "@/lib/streak";

/** Rank a subject or topic only once there is enough signal. */
export const MIN_ATTEMPTED_TO_RANK = 5;

const correctCount = sql<number>`count(*) filter (where ${attempts.result} = 'correct')::int`;
const wrongCount = sql<number>`count(*) filter (where ${attempts.result} = 'wrong')::int`;
const skippedCount = sql<number>`count(*) filter (where ${attempts.result} = 'skipped')::int`;
const pointsSum = sql<number>`coalesce(sum(${attempts.points}), 0)::int`;

export interface SubjectProgress {
  subjectId: number;
  name: string;
  correct: number;
  wrong: number;
  skipped: number;
  attempted: number;
  accuracy: number | null;
  points: number;
}

export interface TopicProgress {
  topicId: number;
  topic: string;
  subject: string;
  correct: number;
  wrong: number;
  attempted: number;
  accuracy: number | null;
  /** Estimated accuracy on new questions in this topic (shrunk first-attempt accuracy). */
  estimate: number;
}

export interface SessionPoint {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  subject: string | null;
  topic: string | null;
  questionCount: number;
  answered: number;
  correct: number;
  wrong: number;
  points: number;
}

/** MedMCQA topic names are inconsistently cased ("mycology"); capitalise the first letter for display. */
export const displayName = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

const accuracy = (correct: number, wrong: number) => (correct + wrong === 0 ? null : correct / (correct + wrong));

export async function getProgress(userId: string) {
  const db = getDb();

  const [units, totals, subjectRows, topicRows, sessionRows, dayRows, completedRows] = await Promise.all([
    getUnitStats(userId),

    db
      .select({ correct: correctCount, wrong: wrongCount, skipped: skippedCount, points: pointsSum })
      .from(attempts)
      .where(eq(attempts.userId, userId)),

    db
      .select({
        subjectId: subjects.id,
        name: subjects.name,
        correct: correctCount,
        wrong: wrongCount,
        skipped: skippedCount,
        points: pointsSum,
      })
      .from(attempts)
      .innerJoin(questions, eq(questions.id, attempts.questionId))
      .innerJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(eq(attempts.userId, userId))
      .groupBy(subjects.id, subjects.name),

    db
      .select({
        topicId: topics.id,
        topic: topics.name,
        subject: subjects.name,
        subjectId: subjects.id,
        correct: correctCount,
        wrong: wrongCount,
      })
      .from(attempts)
      .innerJoin(questions, eq(questions.id, attempts.questionId))
      .innerJoin(topics, eq(topics.id, questions.topicId))
      .innerJoin(subjects, eq(subjects.id, topics.subjectId))
      .where(eq(attempts.userId, userId))
      .groupBy(topics.id, topics.name, subjects.name, subjects.id)
      .having(sql`count(*) filter (where ${attempts.result} = 'wrong') > 0`),

    db
      .select({
        id: practiceSessions.id,
        startedAt: practiceSessions.startedAt,
        endedAt: practiceSessions.endedAt,
        subject: subjects.name,
        topic: topics.name,
        questionCount: practiceSessions.questionCount,
        answered: sql<number>`count(${attempts.id})::int`,
        correct: correctCount,
        wrong: wrongCount,
        points: pointsSum,
      })
      .from(practiceSessions)
      .leftJoin(subjects, eq(subjects.id, practiceSessions.subjectId))
      .leftJoin(topics, eq(topics.id, practiceSessions.topicId))
      .leftJoin(attempts, eq(attempts.sessionId, practiceSessions.id))
      .where(eq(practiceSessions.userId, userId))
      .groupBy(practiceSessions.id, subjects.name, topics.name)
      .orderBy(desc(practiceSessions.startedAt))
      .limit(30),

    db
      .selectDistinct({
        day: sql<string>`to_char(${attempts.createdAt} at time zone ${APP_TIME_ZONE}, 'YYYY-MM-DD')`,
      })
      .from(attempts)
      .where(and(eq(attempts.userId, userId), isNotNull(attempts.createdAt))),

    db
      .select({ n: sql<number>`count(*)::int` })
      .from(practiceSessions)
      .where(and(eq(practiceSessions.userId, userId), isNotNull(practiceSessions.endedAt))),
  ]);

  const t = totals[0] ?? { correct: 0, wrong: 0, skipped: 0, points: 0 };

  const subjectsProgress: SubjectProgress[] = subjectRows
    .map((r) => ({ ...r, attempted: r.correct + r.wrong, accuracy: accuracy(r.correct, r.wrong) }))
    // Weakest first among subjects with enough attempts; then the rest by activity.
    .sort((a, b) => {
      const ra = a.attempted >= MIN_ATTEMPTED_TO_RANK;
      const rb = b.attempted >= MIN_ATTEMPTED_TO_RANK;
      if (ra !== rb) return ra ? -1 : 1;
      if (ra && rb && a.accuracy !== b.accuracy) return (a.accuracy ?? 0) - (b.accuracy ?? 0);
      return b.attempted - a.attempted;
    });

  // Same estimate the smart mix uses: first answers only, shrunk toward the
  // subject so one unlucky answer doesn't flag a topic (lib/recommend.ts).
  const estimate = new Map(unitBeliefs(units).map((u) => [u.key, u.mean]));
  const weakTopics: TopicProgress[] = topicRows
    .map((r) => ({
      topicId: r.topicId,
      topic: displayName(r.topic),
      subject: r.subject,
      correct: r.correct,
      wrong: r.wrong,
      attempted: r.correct + r.wrong,
      accuracy: accuracy(r.correct, r.wrong),
      estimate: estimate.get(unitKey(r.subjectId, r.topicId)) ?? SMART_MIX.baselineAccuracy,
    }))
    .filter((t) => t.estimate < SMART_MIX.targetSuccess)
    .sort((a, b) => a.estimate - b.estimate || b.wrong - a.wrong)
    .slice(0, 5);

  const sessions: SessionPoint[] = sessionRows.map((r) => ({ ...r, topic: r.topic ? displayName(r.topic) : null }));
  const completed = sessions.filter((s) => s.endedAt !== null);

  return {
    overview: {
      points: t.points,
      correct: t.correct,
      wrong: t.wrong,
      skipped: t.skipped,
      attempted: t.correct + t.wrong,
      accuracy: accuracy(t.correct, t.wrong),
      completedSessions: completedRows[0]?.n ?? 0,
      streak: computeStreak(
        dayRows.map((r) => r.day),
        dayKey(new Date()),
      ),
    },
    subjects: subjectsProgress,
    weakTopics,
    /** Oldest first, completed sessions only. */
    trend: completed.slice(0, 20).reverse(),
    recent: sessions.slice(0, 8),
  };
}

export type Progress = Awaited<ReturnType<typeof getProgress>>;
