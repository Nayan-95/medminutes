import { and, asc, eq, inArray, min, sql, sum } from "drizzle-orm";
import { cacheLife } from "next/cache";

import { getDb } from "@/db";
import { attempts, practiceSessions, questions, reviewCards, subjects, topics } from "@/db/schema";
import type { AttemptResult, Option } from "@/lib/scoring";
import { drawDueCards } from "@/lib/smart-mix";
import { cleanOptional, cleanText } from "@/lib/text";

export const QUESTION_COUNTS = [10, 20, 50] as const;

/** Subjects with their question counts. Changes only when we re-import, so cache it. */
export async function listSubjects() {
  "use cache";
  cacheLife("days");
  return getDb()
    .select({
      id: subjects.id,
      name: subjects.name,
      questionCount: sql<number>`count(${questions.id})::int`,
    })
    .from(subjects)
    .innerJoin(questions, eq(questions.subjectId, subjects.id))
    .groupBy(subjects.id)
    .orderBy(asc(subjects.name));
}

/** Lifetime NEET PG score: sum of all attempt points. Can be negative. */
export async function getTotalScore(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ total: sum(attempts.points).mapWith(Number) })
    .from(attempts)
    .where(eq(attempts.userId, userId));
  return row?.total ?? 0;
}

/** Questions due for review now, the ones you're most likely to have forgotten first. */
export async function drawDueQuestionIds(userId: string, count: number): Promise<number[]> {
  return (await drawDueCards(userId, count)).map((r) => r.questionId);
}

/** How many questions are due now, and when the next one becomes due. */
export async function getReviewStatus(userId: string): Promise<{ due: number; nextDueAt: Date | null; total: number }> {
  const now = new Date();
  const [row] = await getDb()
    .select({
      due: sql<number>`count(*) filter (where ${reviewCards.due} <= ${now})::int`,
      total: sql<number>`count(*)::int`,
      nextDueAt: min(sql<Date>`case when ${reviewCards.due} > ${now} then ${reviewCards.due} end`).mapWith((v) => (v ? new Date(v) : null)),
    })
    .from(reviewCards)
    .where(eq(reviewCards.userId, userId));
  return { due: row?.due ?? 0, total: row?.total ?? 0, nextDueAt: row?.nextDueAt ?? null };
}

export interface PracticeQuestion {
  id: number;
  question: string;
  options: Record<Option, string>;
  subject: string;
}

export interface RecordedAttempt {
  questionId: number;
  selectedOption: Option | null;
  result: AttemptResult;
  points: number;
  correctOption: Option;
  explanation: string | null;
  /** When FSRS will bring this question back (null if unknown). */
  nextReviewAt?: Date | null;
}

/**
 * Loads a session for its owner. Questions are returned WITHOUT their answers;
 * answers are only included for questions the user has already submitted.
 */
export async function getSessionForUser(sessionId: string, userId: string) {
  const db = getDb();
  const [row] = await db
    .select({ session: practiceSessions, topicName: topics.name })
    .from(practiceSessions)
    .leftJoin(topics, eq(topics.id, practiceSessions.topicId))
    .where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId)));
  if (!row) return null;
  const session = row.session;
  const topicName = row.topicName ? row.topicName.charAt(0).toUpperCase() + row.topicName.slice(1) : null;

  const rows = await db
    .select({
      id: questions.id,
      question: questions.question,
      a: questions.optionA,
      b: questions.optionB,
      c: questions.optionC,
      d: questions.optionD,
      subject: subjects.name,
    })
    .from(questions)
    .innerJoin(subjects, eq(subjects.id, questions.subjectId))
    .where(inArray(questions.id, session.questionIds));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const ordered: PracticeQuestion[] = session.questionIds.flatMap((id) => {
    const r = byId.get(id);
    if (!r) return [];
    const options = { A: cleanText(r.a), B: cleanText(r.b), C: cleanText(r.c), D: cleanText(r.d) };
    return [
      {
        id: r.id,
        question: cleanText(r.question),
        options,
        subject: r.subject,
      },
    ];
  });

  const doneRaw: RecordedAttempt[] = await db
    .select({
      questionId: attempts.questionId,
      selectedOption: attempts.selectedOption,
      result: attempts.result,
      points: attempts.points,
      correctOption: questions.correctOption,
      explanation: questions.explanation,
      nextReviewAt: reviewCards.due,
    })
    .from(attempts)
    .innerJoin(questions, eq(questions.id, attempts.questionId))
    .leftJoin(reviewCards, and(eq(reviewCards.userId, attempts.userId), eq(reviewCards.questionId, attempts.questionId)))
    .where(eq(attempts.sessionId, sessionId));
  const done = doneRaw.map((a) => ({ ...a, explanation: cleanOptional(a.explanation) }));

  return { session, topicName, questions: ordered, attempts: done };
}
