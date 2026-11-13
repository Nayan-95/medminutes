import { and, asc, eq, inArray, sql, sum } from "drizzle-orm";
import { cacheLife } from "next/cache";

import { getDb } from "@/db";
import { attempts, practiceSessions, questions, subjects } from "@/db/schema";
import type { AttemptResult, Option } from "@/lib/scoring";
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

export async function drawQuestionIds(subjectId: number | null, count: number): Promise<number[]> {
  const rows = await getDb()
    .select({ id: questions.id })
    .from(questions)
    .where(subjectId === null ? undefined : eq(questions.subjectId, subjectId))
    .orderBy(sql`random()`)
    .limit(count);
  return rows.map((r) => r.id);
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
}

/**
 * Loads a session for its owner. Questions are returned WITHOUT their answers;
 * answers are only included for questions the user has already submitted.
 */
export async function getSessionForUser(sessionId: string, userId: string) {
  const db = getDb();
  const [session] = await db
    .select()
    .from(practiceSessions)
    .where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId)));
  if (!session) return null;

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
    return r
      ? [
          {
            id: r.id,
            question: cleanText(r.question),
            options: { A: cleanText(r.a), B: cleanText(r.b), C: cleanText(r.c), D: cleanText(r.d) },
            subject: r.subject,
          },
        ]
      : [];
  });

  const doneRaw: RecordedAttempt[] = await db
    .select({
      questionId: attempts.questionId,
      selectedOption: attempts.selectedOption,
      result: attempts.result,
      points: attempts.points,
      correctOption: questions.correctOption,
      explanation: questions.explanation,
    })
    .from(attempts)
    .innerJoin(questions, eq(questions.id, attempts.questionId))
    .where(eq(attempts.sessionId, sessionId));
  const done = doneRaw.map((a) => ({ ...a, explanation: cleanOptional(a.explanation) }));

  return { session, questions: ordered, attempts: done };
}
