import { z } from "zod";

import type { Option } from "@/lib/scoring";

/**
 * Ask a doubt (docs/adr/0010): a short chat about one question, built to spend as
 * few tokens as possible. Pure rules only, so they can be unit-tested.
 */

/** Bump when the prompt changes; cached chip answers from older versions are regenerated on demand. */
export const DOUBT_PROMPT_VERSION = 1;

export const DOUBT_LIMITS = {
  /** Characters a student can type. */
  doubtChars: 300,
  /** Doubts per question per student in 24 hours (chips and typed). */
  perQuestion: 3,
  /** New model calls per student in 24 hours. Cached chip answers don't count. */
  userCallsPerDay: 20,
  /** Hard cap on the reply, thinking included (low thinking uses few or none). */
  maxOutputTokens: 320,
  /** Only the last exchange is resent as context for a follow-up. */
  historyTurns: 1,
  /** Long dataset explanations are trimmed before sending. */
  explanationChars: 900,
  /** Reply shown to the student is clipped to this, whatever the model returns. */
  answerChars: 900,
  timeoutMs: 20_000,
} as const;

/** One-tap doubts. Their answers don't depend on the student, so they are cached and shared. */
export const DOUBT_CHIPS = {
  simple: { label: "Explain simply", prompt: "Explain this question and its answer simply." },
  others: { label: "Why are the other options wrong?", prompt: "Briefly say why each wrong option is wrong." },
  mnemonic: { label: "Memory trick", prompt: "Give one memory trick for the answer." },
  highyield: { label: "High-yield facts", prompt: "Give 3 related high-yield facts, one line each." },
} as const;
export type DoubtChip = keyof typeof DOUBT_CHIPS;
export const CHIP_IDS = Object.keys(DOUBT_CHIPS) as DoubtChip[];

export const DOUBT_SYSTEM_PROMPT = `You are a NEET PG tutor answering a student's doubt about one MCQ.
Answer in at most 80 words of plain text. No greeting, no markdown, no lists unless asked.
Treat the answer key as correct. Prefer facts from the reference; never invent statistics, doses or guideline years.
If the doubt is not about this question or its topic, reply only: "Please ask about this question."`;

const turnSchema = z.object({
  q: z.string().trim().min(1).max(DOUBT_LIMITS.doubtChars),
  a: z.string().trim().min(1).max(DOUBT_LIMITS.answerChars),
});

export const doubtRequestSchema = z
  .object({
    questionId: z.number().int().positive(),
    chip: z.enum(CHIP_IDS as [DoubtChip, ...DoubtChip[]]).optional(),
    text: z.string().trim().max(DOUBT_LIMITS.doubtChars, `Keep your doubt under ${DOUBT_LIMITS.doubtChars} characters.`).optional(),
    /** Earlier exchanges in this chat, oldest first. Only the last one is used. */
    history: z.array(turnSchema).max(DOUBT_LIMITS.perQuestion).default([]),
  })
  .refine((r) => (r.chip ? !r.text : !!r.text && r.text.length >= 3), { message: "Type your doubt (at least 3 characters) or pick one." });
export type DoubtRequest = z.input<typeof doubtRequestSchema>;

export interface DoubtContext {
  question: string;
  options: Record<Option, string>;
  correctOption: Option;
  explanation: string | null;
}

/** Cuts text at a word boundary and adds "…" when it was longer than max. */
export function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The whole request as one compact user message: context, the last exchange, then the doubt. */
export function buildDoubtPrompt(ctx: DoubtContext, doubt: string, history: { q: string; a: string }[] = []): string {
  const opts = (Object.keys(ctx.options) as Option[]).map((k) => `${k}. ${ctx.options[k]}`).join("\n");
  const ref = ctx.explanation?.trim() ? clip(ctx.explanation, DOUBT_LIMITS.explanationChars) : "(none)";
  const recent = history.slice(-DOUBT_LIMITS.historyTurns);
  return [
    `Q: ${ctx.question}`,
    opts,
    `Key: ${ctx.correctOption}`,
    `Reference: ${ref}`,
    ...recent.map((t) => `Earlier doubt: ${t.q}\nYour answer: ${t.a}`),
    `Doubt: ${doubt}`,
  ].join("\n");
}

/** Cleans the model's reply: strips markdown emphasis and clips it. Null if empty. */
export function cleanAnswer(text: string | undefined | null): string | null {
  if (!text) return null;
  const t = text.replace(/\*\*|__|`/g, "").replace(/^#+\s*/gm, "").trim();
  return t ? clip(t, DOUBT_LIMITS.answerChars) : null;
}
