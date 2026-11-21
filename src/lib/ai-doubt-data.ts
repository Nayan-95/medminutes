import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { aiDoubtCache, aiUsage, questions } from "@/db/schema";
import { buildDoubtPrompt, DOUBT_CHIPS, DOUBT_LIMITS, DOUBT_PROMPT_VERSION, doubtRequestSchema, type DoubtRequest } from "@/lib/ai-doubt";
import { globalDailyCap } from "@/lib/ai-explain";
import { aiConfigured, aiModel, generateDoubtAnswer } from "@/lib/ai-gemini";
import { hasSeenAnswer } from "@/lib/seen";
import { cleanOptional, cleanText } from "@/lib/text";

/** Ask a doubt (docs/adr/0010): limits, cache and the model call. Typed doubts are never stored. */

export type DoubtResponse = { ok: true; answer: string; remaining: number; cached: boolean } | { ok: false; message: string; remaining?: number };

const DAY_MS = 24 * 60 * 60 * 1000;

export async function askDoubt(userId: string, raw: DoubtRequest): Promise<DoubtResponse> {
  const parsed = doubtRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check your doubt and try again." };
  const req = parsed.data;
  const db = getDb();
  const since = new Date(Date.now() - DAY_MS);

  const [seen, [q], [usage], cached] = await Promise.all([
    hasSeenAnswer(userId, req.questionId),
    db
      .select({
        question: questions.question,
        a: questions.optionA,
        b: questions.optionB,
        c: questions.optionC,
        d: questions.optionD,
        correct: questions.correctOption,
        explanation: questions.explanation,
      })
      .from(questions)
      .where(eq(questions.id, req.questionId)),
    db
      .select({
        onQuestion: sql<number>`count(*) filter (where ${aiUsage.userId} = ${userId} and ${aiUsage.kind} = 'doubt' and ${aiUsage.questionId} = ${req.questionId})::int`,
        userCalls: sql<number>`count(*) filter (where ${aiUsage.userId} = ${userId} and ${aiUsage.kind} = 'doubt' and not ${aiUsage.cached})::int`,
        globalCalls: sql<number>`count(*) filter (where not ${aiUsage.cached})::int`,
      })
      .from(aiUsage)
      .where(gte(aiUsage.createdAt, since)),
    req.chip
      ? db
          .select({ answer: aiDoubtCache.answer })
          .from(aiDoubtCache)
          .where(
            and(
              eq(aiDoubtCache.questionId, req.questionId),
              eq(aiDoubtCache.chip, req.chip),
              eq(aiDoubtCache.promptVersion, DOUBT_PROMPT_VERSION),
            ),
          )
          .then((rows) => rows[0]?.answer ?? null)
      : Promise.resolve(null),
  ]);

  if (!seen || !q) return { ok: false, message: "You can ask doubts after you've answered this question." };
  const remaining = Math.max(0, DOUBT_LIMITS.perQuestion - usage.onQuestion);
  if (remaining === 0) return { ok: false, remaining: 0, message: `You've asked ${DOUBT_LIMITS.perQuestion} doubts on this question today.` };

  const now = new Date();
  if (cached) {
    await db.insert(aiUsage).values({ userId, questionId: req.questionId, cached: true, kind: "doubt", createdAt: now });
    return { ok: true, answer: cached, remaining: remaining - 1, cached: true };
  }

  if (usage.userCalls >= DOUBT_LIMITS.userCallsPerDay) {
    return { ok: false, remaining, message: `You've used today's ${DOUBT_LIMITS.userCallsPerDay} AI doubts. They refill over the next 24 hours.` };
  }
  if (usage.globalCalls >= globalDailyCap()) return { ok: false, remaining, message: "AI is busy today. Please try again tomorrow." };
  if (!aiConfigured()) return { ok: false, remaining, message: "Ask a doubt isn't available right now." };

  // Count the call before making it, so parallel sends can't overshoot the caps.
  await db.insert(aiUsage).values({ userId, questionId: req.questionId, cached: false, kind: "doubt", createdAt: now });

  const doubt = req.chip ? DOUBT_CHIPS[req.chip].prompt : req.text!;
  const prompt = buildDoubtPrompt(
    {
      question: cleanText(q.question),
      options: { A: cleanText(q.a), B: cleanText(q.b), C: cleanText(q.c), D: cleanText(q.d) },
      correctOption: q.correct,
      explanation: cleanOptional(q.explanation),
    },
    doubt,
    // Chip answers are shared, so they must not depend on this student's chat.
    req.chip ? [] : req.history,
  );
  const result = await generateDoubtAnswer(prompt);
  if (!result.ok) {
    return {
      ok: false,
      remaining,
      message: result.reason === "rate-limited" ? "AI is busy right now. Try again in a minute." : "Couldn't answer that. Please try again.",
    };
  }

  if (req.chip) {
    await db
      .insert(aiDoubtCache)
      .values({ questionId: req.questionId, chip: req.chip, promptVersion: DOUBT_PROMPT_VERSION, model: aiModel(), answer: result.answer })
      .onConflictDoNothing({ target: [aiDoubtCache.questionId, aiDoubtCache.chip, aiDoubtCache.promptVersion] });
  }
  return { ok: true, answer: result.answer, remaining: remaining - 1, cached: false };
}

