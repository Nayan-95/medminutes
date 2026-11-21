import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { aiExplanations, aiUsage, attempts, questions } from "@/db/schema";
import {
  buildPrompt,
  checkLimits,
  explanationSchema,
  globalDailyCap,
  LIMIT_MESSAGE,
  PROMPT_VERSION,
  type AiExplanation,
} from "@/lib/ai-explain";
import { aiConfigured, aiModel, generateExplanation } from "@/lib/ai-gemini";
import type { Option } from "@/lib/scoring";
import { cleanOptional, cleanText } from "@/lib/text";

/** "Why was I wrong?" (docs/adr/0009): database side and the full request flow. */

export type ExplainResult =
  | { ok: true; explanation: AiExplanation; chosenOption: Option; correctOption: Option; cached: boolean }
  | { ok: false; message: string };

const DAY_MS = 24 * 60 * 60 * 1000;

async function readCache(questionId: number, chosen: Option): Promise<AiExplanation | null> {
  const [row] = await getDb()
    .select({ content: aiExplanations.content })
    .from(aiExplanations)
    .where(
      and(
        eq(aiExplanations.questionId, questionId),
        eq(aiExplanations.chosenOption, chosen),
        eq(aiExplanations.promptVersion, PROMPT_VERSION),
      ),
    );
  if (!row) return null;
  const parsed = explanationSchema.safeParse(JSON.parse(row.content));
  return parsed.success ? parsed.data : null;
}

async function usageSince(userId: string, since: Date) {
  const [row] = await getDb()
    .select({
      userCalls: sql<number>`count(*) filter (where ${aiUsage.userId} = ${userId} and ${aiUsage.kind} = 'explain' and not ${aiUsage.cached})::int`,
      userRequests: sql<number>`count(*) filter (where ${aiUsage.userId} = ${userId} and ${aiUsage.kind} = 'explain')::int`,
      globalCalls: sql<number>`count(*) filter (where not ${aiUsage.cached})::int`,
    })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, since));
  return row ?? { userCalls: 0, userRequests: 0, globalCalls: 0 };
}

/**
 * Explains the user's most recent wrong answer to this question. The chosen option
 * comes from the user's own attempts, never from the browser, so nobody can ask the
 * model about questions they haven't got wrong.
 */
export async function explainMistake(userId: string, questionId: number): Promise<ExplainResult> {
  const db = getDb();
  const [wrong] = await db
    .select({
      chosen: attempts.selectedOption,
      question: questions.question,
      a: questions.optionA,
      b: questions.optionB,
      c: questions.optionC,
      d: questions.optionD,
      correct: questions.correctOption,
      explanation: questions.explanation,
    })
    .from(attempts)
    .innerJoin(questions, eq(questions.id, attempts.questionId))
    .where(and(eq(attempts.userId, userId), eq(attempts.questionId, questionId), eq(attempts.result, "wrong")))
    .orderBy(desc(attempts.createdAt))
    .limit(1);
  if (!wrong?.chosen) return { ok: false, message: "AI explanations are only for questions you answered wrongly." };
  const chosen = wrong.chosen;

  const now = new Date();
  const [cached, usage] = await Promise.all([readCache(questionId, chosen), usageSince(userId, new Date(now.getTime() - DAY_MS))]);

  const limit = checkLimits(usage, globalDailyCap(), !cached);
  if (!limit.ok) return { ok: false, message: LIMIT_MESSAGE[limit.reason] };

  if (cached) {
    await db.insert(aiUsage).values({ userId, questionId, cached: true, createdAt: now });
    return { ok: true, explanation: cached, chosenOption: chosen, correctOption: wrong.correct, cached: true };
  }

  if (!aiConfigured()) return { ok: false, message: "AI explanations aren't available right now." };

  // Count the call before making it, so parallel clicks can't overshoot the caps by much.
  await db.insert(aiUsage).values({ userId, questionId, cached: false, createdAt: now });

  const options = { A: cleanText(wrong.a), B: cleanText(wrong.b), C: cleanText(wrong.c), D: cleanText(wrong.d) };
  const result = await generateExplanation(
    buildPrompt({
      question: cleanText(wrong.question),
      options,
      correctOption: wrong.correct,
      chosenOption: chosen,
      explanation: cleanOptional(wrong.explanation),
    }),
  );
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "rate-limited"
          ? "AI explanations are busy right now. Try again in a minute."
          : "Couldn't get an AI explanation. Please try again.",
    };
  }

  // Another user may have generated the same one meanwhile; the first stored answer wins.
  await db
    .insert(aiExplanations)
    .values({
      questionId,
      chosenOption: chosen,
      promptVersion: PROMPT_VERSION,
      model: aiModel(),
      content: JSON.stringify(result.explanation),
    })
    .onConflictDoNothing({ target: [aiExplanations.questionId, aiExplanations.chosenOption, aiExplanations.promptVersion] });

  return { ok: true, explanation: result.explanation, chosenOption: chosen, correctOption: wrong.correct, cached: false };
}
