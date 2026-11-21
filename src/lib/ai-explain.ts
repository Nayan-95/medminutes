import { z } from "zod";

import type { Option } from "@/lib/scoring";

/**
 * "Why was I wrong?" (docs/adr/0009): the prompt, the answer's shape and the limits.
 * Kept free of the database and the network so it can be unit-tested.
 */

/** Bump when the prompt or schema changes; cached answers from older versions are then regenerated on demand. */
export const PROMPT_VERSION = 1;

export const AI_LIMITS = {
  /** New model calls per user in any 24 hours. Cached answers don't count. */
  userCallsPerDay: 15,
  /** All requests per user in 24 hours, cached included (stops bulk scraping). */
  userRequestsPerDay: 150,
  /** New model calls across all users in 24 hours; keeps us inside the free tier. Override with AI_DAILY_CAP. */
  globalCallsPerDay: 400,
  /** Give up on the model after this long. */
  timeoutMs: 25_000,
} as const;

export function globalDailyCap(raw = process.env.AI_DAILY_CAP): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : AI_LIMITS.globalCallsPerDay;
}

export const DEFAULT_MODEL = "gemini-3.8-flash";

export const explanationSchema = z.object({
  whyWrong: z.string().trim().min(10).max(700),
  whyRight: z.string().trim().min(10).max(700),
  remember: z.string().trim().min(5).max(300),
});
export type AiExplanation = z.infer<typeof explanationSchema>;

/** JSON Schema sent to the model so it answers in exactly this shape. */
export const explanationJsonSchema = {
  type: "object",
  properties: {
    whyWrong: { type: "string", description: "Why the student's option is wrong, in 2–3 sentences." },
    whyRight: { type: "string", description: "Why the correct option is right, in 2–3 sentences." },
    remember: { type: "string", description: "One high-yield fact or memory hook, in one sentence." },
  },
  required: ["whyWrong", "whyRight", "remember"],
  additionalProperties: false,
} as const;

export const SYSTEM_PROMPT = `You are a concise NEET PG tutor. A student answered a multiple-choice question wrongly.
Explain the mistake using the question, the options, the answer key and the reference explanation given to you.
Rules:
- Treat the answer key as correct. Do not argue with it.
- Prefer facts from the reference explanation. If you add a fact that is not in it, it must be standard textbook knowledge.
- Never invent statistics, studies, drug doses or guideline years.
- Plain English for an Indian medical graduate. No greetings, no markdown, no bullet characters.
- Keep whyWrong and whyRight to 2–3 sentences each and remember to one sentence.`;

export interface ExplainInput {
  question: string;
  options: Record<Option, string>;
  correctOption: Option;
  chosenOption: Option;
  explanation: string | null;
}

/** The user message. Only question content goes to the model, never anything about the student. */
export function buildPrompt(input: ExplainInput): string {
  if (input.chosenOption === input.correctOption) throw new Error("The chosen option is the correct one.");
  const opts = (Object.keys(input.options) as Option[]).map((k) => `${k}. ${input.options[k]}`).join("\n");
  return [
    `Question:\n${input.question}`,
    `Options:\n${opts}`,
    `Answer key: ${input.correctOption}. ${input.options[input.correctOption]}`,
    `Student chose: ${input.chosenOption}. ${input.options[input.chosenOption]}`,
    `Reference explanation:\n${input.explanation?.trim() || "(none provided)"}`,
  ].join("\n\n");
}

/** Parses and validates the model's JSON. Returns null for anything malformed. */
export function parseExplanation(text: string | undefined | null): AiExplanation | null {
  if (!text) return null;
  try {
    const parsed = explanationSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type LimitCheck = { ok: true } | { ok: false; reason: "user-calls" | "user-requests" | "global" };

export function checkLimits(usage: { userCalls: number; userRequests: number; globalCalls: number }, globalCap: number, willCall: boolean): LimitCheck {
  if (usage.userRequests >= AI_LIMITS.userRequestsPerDay) return { ok: false, reason: "user-requests" };
  if (!willCall) return { ok: true };
  if (usage.userCalls >= AI_LIMITS.userCallsPerDay) return { ok: false, reason: "user-calls" };
  if (usage.globalCalls >= globalCap) return { ok: false, reason: "global" };
  return { ok: true };
}

export const LIMIT_MESSAGE: Record<Exclude<LimitCheck, { ok: true }>["reason"], string> = {
  "user-calls": `You've used today's ${AI_LIMITS.userCallsPerDay} AI explanations. They refill over the next 24 hours.`,
  "user-requests": "You've reached today's limit for AI explanations. Try again tomorrow.",
  global: "AI explanations are busy today. Please try again tomorrow.",
};
