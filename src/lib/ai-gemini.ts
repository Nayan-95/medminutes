import "server-only";

import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";

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
