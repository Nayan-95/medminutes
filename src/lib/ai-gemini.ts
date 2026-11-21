import "server-only";

import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";

import { cleanAnswer, DOUBT_LIMITS, DOUBT_SYSTEM_PROMPT } from "@/lib/ai-doubt";
import { AI_LIMITS, DEFAULT_MODEL, explanationJsonSchema, parseExplanation, SYSTEM_PROMPT, type AiExplanation } from "@/lib/ai-explain";

/** Gemini client for "Why was I wrong?" (docs/adr/0009). Server only; the key never reaches the browser. */

let client: GoogleGenAI | null = null;

export function aiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function aiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

export type GenerateResult = { ok: true; explanation: AiExplanation } | { ok: false; reason: "rate-limited" | "failed" };

export async function generateExplanation(prompt: string): Promise<GenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, reason: "failed" };
  client ??= new GoogleGenAI({ apiKey });

  try {
    const response = await client.models.generateContent({
      model: aiModel(),
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: explanationJsonSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: 2048,
        abortSignal: AbortSignal.timeout(AI_LIMITS.timeoutMs),
      },
    });
    const explanation = parseExplanation(response.text);
    if (!explanation) {
      console.error("Gemini returned an unusable answer", { finish: response.candidates?.[0]?.finishReason });
      return { ok: false, reason: "failed" };
    }
    return { ok: true, explanation };
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) return { ok: false, reason: "rate-limited" };
    // Never log the request itself: it would not leak secrets, but keep logs small.
    console.error("Gemini call failed", e instanceof ApiError ? { status: e.status, message: e.message } : e);
    return { ok: false, reason: "failed" };
  }
}

export type DoubtResult = { ok: true; answer: string; tokens: number | null } | { ok: false; reason: "rate-limited" | "failed" };

/**
 * Ask a doubt (docs/adr/0010): plain text (no JSON overhead), low thinking (MINIMAL is rejected by gemini-3.8-flash) and a
 * hard output cap, so a reply costs a few hundred tokens at most.
 */
export async function generateDoubtAnswer(prompt: string): Promise<DoubtResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, reason: "failed" };
  client ??= new GoogleGenAI({ apiKey });

  try {
    const response = await client.models.generateContent({
      model: aiModel(),
      contents: prompt,
      config: {
        systemInstruction: DOUBT_SYSTEM_PROMPT,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        maxOutputTokens: DOUBT_LIMITS.maxOutputTokens,
        abortSignal: AbortSignal.timeout(DOUBT_LIMITS.timeoutMs),
      },
    });
    const answer = cleanAnswer(response.text);
    if (!answer) {
      console.error("Gemini returned an empty doubt answer", { finish: response.candidates?.[0]?.finishReason });
      return { ok: false, reason: "failed" };
    }
    return { ok: true, answer, tokens: response.usageMetadata?.totalTokenCount ?? null };
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) return { ok: false, reason: "rate-limited" };
    console.error("Gemini doubt call failed", e instanceof ApiError ? { status: e.status, message: e.message } : e);
    return { ok: false, reason: "failed" };
  }
}
