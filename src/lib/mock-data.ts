import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { attempts, mockExams, mockResponses, practiceSessions, questions, reviewCards, subjects } from "@/db/schema";
import {
  analyseMock,
  MOCK_FORMATS,
  mockClock,
  allocateBySubject,
  percentileAmong,
  totalQuestions,
  type MockFormat,
  type MockFormatId,
  type MockQuestionResult,
} from "@/lib/mock";
import { listSubjects, type PracticeQuestion } from "@/lib/practice";
import { shuffled } from "@/lib/random";
import { scoreAnswer, type Option } from "@/lib/scoring";
import { fromRow, schedule, toRow } from "@/lib/srs";
import { cleanOptional, cleanText } from "@/lib/text";

export const MOCK_POLICY = "mock-v1";

/**
 * Draws a mock: questions per subject by the blueprint, preferring questions
 * this user has never answered, then shuffled so sections mix subjects (as in
 * NEET PG). One query for all subjects.
 */
export async function drawMockQuestions(userId: string, total: number): Promise<number[]> {
  const bank = await listSubjects();
  const quota = allocateBySubject(bank.map((s) => ({ id: s.id, name: s.name, available: s.questionCount })), total);
  if (quota.size === 0) return [];
  const subjectIds = [...quota.keys()];
  const counts = subjectIds.map((id) => quota.get(id)!);

  const { rows } = await getDb().execute<{ id: number }>(sql`
    with quota as (
      select * from unnest(${`{${subjectIds.join(",")}}`}::int[], ${`{${counts.join(",")}}`}::int[]) as t(subject_id, n)
    ),
    seen as (select distinct question_id from attempts where user_id = ${userId}),
    ranked as (
      select q.id, q.subject_id,
             row_number() over (partition by q.subject_id order by (s.question_id is not null), random()) as rn
        from questions q
        join quota on quota.subject_id = q.subject_id
        left join seen s on s.question_id = q.id
    )
    select r.id from ranked r join quota on quota.subject_id = r.subject_id where r.rn <= quota.n`);
  return shuffled(
    rows.map((r) => Number(r.id)),
    Math.random,
  );
}

/** Creates the session and its mock settings together. Returns the session id. */
export async function createMock(userId: string, formatId: MockFormatId): Promise<string> {
  const f = MOCK_FORMATS[formatId];
  const questionIds = await drawMockQuestions(userId, totalQuestions(f));
  if (questionIds.length < totalQuestions(f)) throw new Error("Not enough questions for a mock exam.");
  return getDb().transaction(async (tx) => {
    const [session] = await tx
      .insert(practiceSessions)
      .values({ userId, kind: "mock", questionCount: questionIds.length, questionIds, policy: MOCK_POLICY })
      .returning({ id: practiceSessions.id, startedAt: practiceSessions.startedAt });
    await tx.insert(mockExams).values({
      sessionId: session.id,
      format: f.id,
      sectionCount: f.sectionCount,
      sectionSize: f.sectionSize,
      sectionSeconds: f.sectionSeconds,
    });
    return session.id;
  });
}

/** The session and its mock settings, for its owner only. */
async function getMockSession(sessionId: string, userId: string) {
  const [row] = await getDb()
    .select({ session: practiceSessions, mock: mockExams })
    .from(practiceSessions)
    .innerJoin(mockExams, eq(mockExams.sessionId, practiceSessions.id))
    .where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId), eq(practiceSessions.kind, "mock")));
  return row ?? null;
}

export type MockSession = NonNullable<Awaited<ReturnType<typeof getMockSession>>>;

export interface MockResponse {
  questionId: number;
  selectedOption: Option | null;
  /** First option ever picked (kept on the client too, so quick changes merged into one save don't lose it). */
  firstOption: Option | null;
  markedForReview: boolean;
}

/**
 * Everything the exam screen needs. Questions come WITHOUT answers. If time ran
 * out while the user was away, the mock is submitted first and `ended` is true.
 */
export async function loadMockForExam(sessionId: string, userId: string) {
  const row = await getMockSession(sessionId, userId);
  if (!row) return null;
  const now = new Date();
  if (!row.session.endedAt && mockClock(row.session.startedAt, row.mock, now).state === "over") {
    await finalizeMock(sessionId, userId);
    return { ...row, ended: true as const };
  }
  if (row.session.endedAt) return { ...row, ended: true as const };

  const db = getDb();
  const [qs, responses] = await Promise.all([
    db
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
      .where(inArray(questions.id, row.session.questionIds)),
    db
      .select({
        questionId: mockResponses.questionId,
        selectedOption: mockResponses.selectedOption,
        firstOption: mockResponses.firstOption,
        markedForReview: mockResponses.markedForReview,
      })
      .from(mockResponses)
      .where(eq(mockResponses.sessionId, sessionId)),
  ]);
  const byId = new Map(qs.map((q) => [q.id, q]));
  const ordered: PracticeQuestion[] = row.session.questionIds.flatMap((id) => {
    const q = byId.get(id);
    if (!q) return [];
    return [{ id, question: cleanText(q.question), subject: q.subject, options: { A: cleanText(q.a), B: cleanText(q.b), C: cleanText(q.c), D: cleanText(q.d) } }];
  });
  return { ...row, ended: false as const, questions: ordered, responses: responses as MockResponse[], serverNow: now };
}

export interface ResponsePatch {
  questionId: number;
  selectedOption: Option | null;
  firstOption: Option | null;
  markedForReview: boolean;
  timeDeltaMs: number;
}

/** Upserts the full current state of each question (idempotent except for time, which adds up). */
export async function upsertResponses(sessionId: string, patches: readonly ResponsePatch[], now: Date) {
  if (patches.length === 0) return;
  await getDb()
    .insert(mockResponses)
    .values(
      patches.map((p) => ({
        sessionId,
        questionId: p.questionId,
        selectedOption: p.selectedOption,
        firstOption: p.firstOption ?? p.selectedOption,
        markedForReview: p.markedForReview,
        timeSpentMs: p.timeDeltaMs,
        visitedAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [mockResponses.sessionId, mockResponses.questionId],
      set: {
        selectedOption: sql`excluded.selected_option`,
        firstOption: sql`coalesce(${mockResponses.firstOption}, excluded.first_option)`,
        markedForReview: sql`excluded.marked_for_review`,
        timeSpentMs: sql`${mockResponses.timeSpentMs} + excluded.time_spent_ms`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

export { getMockSession };

/**
 * Submits a mock: closes the session, copies the final answers into `attempts`
 * and reschedules each question (FSRS), all in one transaction. Only the call
 * that closes the session writes anything, so it is safe to call twice.
 *
 * Answers are dated at the exam's end (or now, if earlier), so a mock that ran
 * out while the user was away still counts on the day it was taken.
 */
export async function finalizeMock(sessionId: string, userId: string): Promise<void> {
  const row = await getMockSession(sessionId, userId);
  if (!row || row.session.endedAt) return;
  const now = new Date();
  const examEnd = mockClock(row.session.startedAt, row.mock, now).examEndsAt;
  const at = now < examEnd ? now : examEnd;

  await getDb().transaction(async (tx) => {
    const closed = await tx
      .update(practiceSessions)
      .set({ endedAt: at })
      .where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.userId, userId), isNull(practiceSessions.endedAt)))
      .returning({ id: practiceSessions.id });
    if (closed.length === 0) return; // someone else submitted it first

    // Opened questions count (unanswered ones as skipped, 0 marks); never-opened ones were never seen.
    const responses = await tx
      .select({
        questionId: mockResponses.questionId,
        selectedOption: mockResponses.selectedOption,
        timeSpentMs: mockResponses.timeSpentMs,
        correctOption: questions.correctOption,
      })
      .from(mockResponses)
      .innerJoin(questions, eq(questions.id, mockResponses.questionId))
      .where(eq(mockResponses.sessionId, sessionId));
    if (responses.length === 0) return;

    const scored = responses.map((r) => ({ ...r, ...scoreAnswer(r.selectedOption, r.correctOption) }));
    await tx
      .insert(attempts)
      .values(
        scored.map((r) => ({
          userId,
          sessionId,
          questionId: r.questionId,
          selectedOption: r.selectedOption,
          result: r.result,
          points: r.points,
          timeTakenMs: r.timeSpentMs,
          createdAt: at,
        })),
      )
      .onConflictDoNothing({ target: [attempts.sessionId, attempts.questionId] });

    const ids = scored.map((r) => r.questionId);
    const existing = await tx
      .select()
      .from(reviewCards)
      .where(and(eq(reviewCards.userId, userId), inArray(reviewCards.questionId, ids)))
      .for("update");
    const cards = new Map(existing.map((c) => [c.questionId, c]));
    await tx
      .insert(reviewCards)
      .values(
        scored.map((r) => {
          const prev = cards.get(r.questionId);
          return { userId, questionId: r.questionId, ...toRow(schedule(prev ? fromRow(prev) : null, r.result, at)), updatedAt: now };
        }),
      )
      .onConflictDoUpdate({
        target: [reviewCards.userId, reviewCards.questionId],
        set: {
          due: sql`excluded.due`,
          stability: sql`excluded.stability`,
          difficulty: sql`excluded.difficulty`,
          elapsedDays: sql`excluded.elapsed_days`,
          scheduledDays: sql`excluded.scheduled_days`,
          learningSteps: sql`excluded.learning_steps`,
          reps: sql`excluded.reps`,
          lapses: sql`excluded.lapses`,
          state: sql`excluded.state`,
          lastReview: sql`excluded.last_review`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  });
}

/** Submits any of this user's mocks whose time has run out (e.g. they closed the tab). */
export async function finalizeExpiredMocks(userId: string): Promise<void> {
  const open = await getDb()
    .select({ id: practiceSessions.id, startedAt: practiceSessions.startedAt, mock: mockExams })
    .from(practiceSessions)
    .innerJoin(mockExams, eq(mockExams.sessionId, practiceSessions.id))
    .where(and(eq(practiceSessions.userId, userId), eq(practiceSessions.kind, "mock"), isNull(practiceSessions.endedAt)));
  const now = new Date();
  for (const m of open) {
    if (mockClock(m.startedAt, m.mock, now).state === "over") await finalizeMock(m.id, userId);
  }
}

export interface MockResultQuestion extends MockQuestionResult {
  question: string;
  options: Record<Option, string>;
  explanation: string | null;
}

/** A submitted mock with answers, analysis and percentile among other mocks of the same format. */
export async function getMockResult(sessionId: string, userId: string) {
  const row = await getMockSession(sessionId, userId);
  if (!row || !row.session.endedAt) return row ? { ...row, submitted: false as const } : null;
  const db = getDb();

  const [qs, responses, others] = await Promise.all([
    db
      .select({
        id: questions.id,
        question: questions.question,
        a: questions.optionA,
        b: questions.optionB,
        c: questions.optionC,
        d: questions.optionD,
        correctOption: questions.correctOption,
        explanation: questions.explanation,
        subject: subjects.name,
      })
      .from(questions)
      .innerJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(inArray(questions.id, row.session.questionIds)),
    db.select().from(mockResponses).where(eq(mockResponses.sessionId, sessionId)),
    db.execute<{ score: number }>(sql`
      select coalesce(sum(a.points), 0)::int as score
        from practice_sessions s
        join mock_exams m on m.session_id = s.id
        left join attempts a on a.session_id = s.id
       where s.kind = 'mock' and s.ended_at is not null and m.format = ${row.mock.format} and s.id <> ${sessionId}
       group by s.id`),
  ]);

  const byId = new Map(qs.map((q) => [q.id, q]));
  const responseById = new Map(responses.map((r) => [r.questionId, r]));
  const items: MockResultQuestion[] = row.session.questionIds.flatMap((id, index) => {
    const q = byId.get(id);
    if (!q) return [];
    const r = responseById.get(id);
    return [
      {
        questionId: id,
        index,
        subject: q.subject,
        correctOption: q.correctOption,
        question: cleanText(q.question),
        options: { A: cleanText(q.a), B: cleanText(q.b), C: cleanText(q.c), D: cleanText(q.d) },
        explanation: cleanOptional(q.explanation),
        response: r && {
          selectedOption: r.selectedOption,
          firstOption: r.firstOption,
          markedForReview: r.markedForReview,
          timeSpentMs: r.timeSpentMs,
        },
      },
    ];
  });

  const analysis = analyseMock(items, row.mock.sectionSize);
  const otherScores = others.rows.map((r) => Number(r.score));
  return {
    ...row,
    submitted: true as const,
    items,
    analysis,
    percentile: percentileAmong(analysis.score, otherScores),
    comparedWith: otherScores.length,
  };
}

/** This user's mocks, newest first, with their scores. */
export async function listMocks(userId: string) {
  const rows = await getDb()
    .select({
      id: practiceSessions.id,
      startedAt: practiceSessions.startedAt,
      endedAt: practiceSessions.endedAt,
      questionCount: practiceSessions.questionCount,
      format: mockExams.format,
      sectionCount: mockExams.sectionCount,
      sectionSeconds: mockExams.sectionSeconds,
      score: sql<number>`coalesce(sum(${attempts.points}), 0)::int`,
      correct: sql<number>`count(*) filter (where ${attempts.result} = 'correct')::int`,
      wrong: sql<number>`count(*) filter (where ${attempts.result} = 'wrong')::int`,
    })
    .from(practiceSessions)
    .innerJoin(mockExams, eq(mockExams.sessionId, practiceSessions.id))
    .leftJoin(attempts, eq(attempts.sessionId, practiceSessions.id))
    .where(and(eq(practiceSessions.userId, userId), eq(practiceSessions.kind, "mock")))
    .groupBy(practiceSessions.id, mockExams.sessionId)
    .orderBy(desc(practiceSessions.startedAt))
    .limit(30);
  return rows;
}

export const formatOf = (id: string): MockFormat => MOCK_FORMATS[id as MockFormatId] ?? MOCK_FORMATS.full;
