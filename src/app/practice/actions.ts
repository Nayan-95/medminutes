"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import { attempts, practiceSessions, questions, reviewCards, topics } from "@/db/schema";
import { requireUserId } from "@/lib/current-user";
import { drawDueQuestionIds, drawQuestionIds, QUESTION_COUNTS, type RecordedAttempt } from "@/lib/practice";
import { OPTIONS, scoreAnswer } from "@/lib/scoring";
import { fromRow, schedule, toRow } from "@/lib/srs";
import { cleanOptional } from "@/lib/text";

const startSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("practice"),
    subjectId: z.union([z.literal("all"), z.coerce.number().int().positive()]),
    topicId: z.coerce.number().int().positive().optional(),
    count: z.coerce
      .number()
      .int()
      .refine((n) => (QUESTION_COUNTS as readonly number[]).includes(n), "Invalid question count"),
  }),
  z.object({
    kind: z.literal("review"),
    count: z.coerce.number().int().min(1).max(50),
  }),
]);

export async function startSession(formData: FormData) {
  const input = startSchema.parse({
    kind: formData.get("kind") ?? "practice",
    subjectId: formData.get("subjectId") ?? undefined,
    topicId: formData.get("topicId") || undefined,
    count: formData.get("count"),
  });
  const userId = await requireUserId();
  const db = getDb();

  if (input.kind === "review") {
    const questionIds = await drawDueQuestionIds(userId, input.count);
    // Nothing due any more (e.g. reviewed in another tab): back to the practice page.
    if (questionIds.length === 0) redirect("/practice");
    const [session] = await db
      .insert(practiceSessions)
      .values({ userId, kind: "review", questionCount: questionIds.length, questionIds })
      .returning({ id: practiceSessions.id });
    redirect(`/practice/${session.id}`);
  }

  let subjectId = input.subjectId === "all" ? null : input.subjectId;
  let topicId: number | null = null;
  if (input.topicId !== undefined) {
    // A topic implies its subject; trust the database, not the form.
    const [topic] = await db
      .select({ id: topics.id, subjectId: topics.subjectId })
      .from(topics)
      .where(eq(topics.id, input.topicId));
    if (!topic) throw new Error("Unknown topic.");
    topicId = topic.id;
    subjectId = topic.subjectId;
  }

  const questionIds = await drawQuestionIds({ subjectId, topicId }, input.count);
  if (questionIds.length === 0) throw new Error("No questions found for that subject.");

  const [session] = await db
    .insert(practiceSessions)
    .values({ userId, subjectId, topicId, questionCount: questionIds.length, questionIds })
    .returning({ id: practiceSessions.id });

  redirect(`/practice/${session.id}`);
}

const answerSchema = z.object({
  sessionId: z.uuid(),
  questionId: z.number().int().positive(),
  selectedOption: z.enum(OPTIONS).nullable(),
  timeTakenMs: z.number().int().min(0).max(60 * 60 * 1000),
});

export type SubmitAnswerInput = z.input<typeof answerSchema>;

/**
 * Marks one answer on the server and reschedules the question (FSRS) in the
 * same transaction. The correct option is only revealed after the answer is
 * stored. Re-submitting the same question returns the originally recorded
 * result and does not reschedule again.
 */
export async function submitAnswer(raw: SubmitAnswerInput): Promise<RecordedAttempt> {
  const input = answerSchema.parse(raw);
  const userId = await requireUserId();
  const db = getDb();

  // One round trip: the session must be open and yours, and contain this question.
  const [q] = await db
    .select({ correctOption: questions.correctOption, explanation: questions.explanation })
    .from(practiceSessions)
    .innerJoin(questions, eq(questions.id, input.questionId))
    .where(
      and(
        eq(practiceSessions.id, input.sessionId),
        eq(practiceSessions.userId, userId),
        isNull(practiceSessions.endedAt),
        sql`${input.questionId} = any(${practiceSessions.questionIds})`,
      ),
    );
  if (!q) throw new Error("This question is not part of an open session.");

  const { result, points } = scoreAnswer(input.selectedOption, q.correctOption);
  const now = new Date();

  const { stored, nextReviewAt } = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(attempts)
      .values({
        userId,
        sessionId: input.sessionId,
        questionId: input.questionId,
        selectedOption: input.selectedOption,
        result,
        points,
        timeTakenMs: input.timeTakenMs,
        createdAt: now,
      })
      .onConflictDoNothing({ target: [attempts.sessionId, attempts.questionId] })
      .returning({ id: attempts.id });

    const cardKey = and(eq(reviewCards.userId, userId), eq(reviewCards.questionId, input.questionId));
    let due: Date | null;
    if (inserted.length > 0) {
      // First submission: advance this question's schedule.
      const [existing] = await tx.select().from(reviewCards).where(cardKey).for("update");
      const row = toRow(schedule(existing ? fromRow(existing) : null, result, now));
      await tx
        .insert(reviewCards)
        .values({ userId, questionId: input.questionId, ...row, updatedAt: now })
        .onConflictDoUpdate({ target: [reviewCards.userId, reviewCards.questionId], set: { ...row, updatedAt: now } });
      due = row.due;
    } else {
      const [card] = await tx.select({ due: reviewCards.due }).from(reviewCards).where(cardKey);
      due = card?.due ?? null;
    }

    if (inserted.length > 0) {
      return { stored: { selectedOption: input.selectedOption, result, points }, nextReviewAt: due };
    }
    // A repeat submission: return what was stored first (the first submission wins).
    const [row] = await tx
      .select({ selectedOption: attempts.selectedOption, result: attempts.result, points: attempts.points })
      .from(attempts)
      .where(and(eq(attempts.sessionId, input.sessionId), eq(attempts.questionId, input.questionId)));
    return { stored: row, nextReviewAt: due };
  });

  return {
    questionId: input.questionId,
    ...stored,
    correctOption: q.correctOption,
    explanation: cleanOptional(q.explanation),
    nextReviewAt,
  };
}

export async function finishSession(sessionId: string) {
  const id = z.uuid().parse(sessionId);
  const userId = await requireUserId();
  await getDb()
    .update(practiceSessions)
    .set({ endedAt: new Date() })
    .where(
      and(
        eq(practiceSessions.id, id),
        eq(practiceSessions.userId, userId),
        isNull(practiceSessions.endedAt),
      ),
    );
  revalidatePath("/", "layout"); // refresh the lifetime score, progress and due counts
  redirect(`/practice/${id}/summary`);
}
