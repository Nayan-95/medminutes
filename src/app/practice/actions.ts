"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "@/db";
import { attempts, practiceSessions, questions } from "@/db/schema";
import { requireUserId } from "@/lib/current-user";
import { drawQuestionIds, QUESTION_COUNTS, type RecordedAttempt } from "@/lib/practice";
import { OPTIONS, scoreAnswer } from "@/lib/scoring";
import { cleanOptional } from "@/lib/text";

const startSchema = z.object({
  subjectId: z.union([z.literal("all"), z.coerce.number().int().positive()]),
  count: z.coerce
    .number()
    .int()
    .refine((n) => (QUESTION_COUNTS as readonly number[]).includes(n), "Invalid question count"),
});

export async function startSession(formData: FormData) {
  const input = startSchema.parse({
    subjectId: formData.get("subjectId"),
    count: formData.get("count"),
  });
  const userId = await requireUserId();
  const subjectId = input.subjectId === "all" ? null : input.subjectId;

  const questionIds = await drawQuestionIds(subjectId, input.count);
  if (questionIds.length === 0) throw new Error("No questions found for that subject.");

  const [session] = await getDb()
    .insert(practiceSessions)
    .values({ userId, subjectId, questionCount: questionIds.length, questionIds })
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
 * Marks one answer on the server. The correct option is only revealed in the
 * response, after the answer is stored. Re-submitting the same question returns
 * the originally recorded result (no double scoring).
 */
export async function submitAnswer(raw: SubmitAnswerInput): Promise<RecordedAttempt> {
  const input = answerSchema.parse(raw);
  const userId = await requireUserId();
  const db = getDb();

  const [session] = await db
    .select({ questionIds: practiceSessions.questionIds })
    .from(practiceSessions)
    .where(
      and(
        eq(practiceSessions.id, input.sessionId),
        eq(practiceSessions.userId, userId),
        isNull(practiceSessions.endedAt),
      ),
    );
  if (!session || !session.questionIds.includes(input.questionId)) {
    throw new Error("This question is not part of an open session.");
  }

  const [q] = await db
    .select({ correctOption: questions.correctOption, explanation: questions.explanation })
    .from(questions)
    .where(eq(questions.id, input.questionId));
  if (!q) throw new Error("Question not found.");

  const { result, points } = scoreAnswer(input.selectedOption, q.correctOption);
  await db
    .insert(attempts)
    .values({
      userId,
      sessionId: input.sessionId,
      questionId: input.questionId,
      selectedOption: input.selectedOption,
      result,
      points,
      timeTakenMs: input.timeTakenMs,
    })
    .onConflictDoNothing({ target: [attempts.sessionId, attempts.questionId] });

  // Return whatever is stored (the first submission wins).
  const [stored] = await db
    .select({
      selectedOption: attempts.selectedOption,
      result: attempts.result,
      points: attempts.points,
    })
    .from(attempts)
    .where(and(eq(attempts.sessionId, input.sessionId), eq(attempts.questionId, input.questionId)));

  return {
    questionId: input.questionId,
    ...stored,
    correctOption: q.correctOption,
    explanation: cleanOptional(q.explanation),
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
  revalidatePath("/", "layout"); // refresh the lifetime score in the header
  redirect(`/practice/${id}/summary`);
}
