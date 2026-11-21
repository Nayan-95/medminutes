"use server";

import { z } from "zod";

import { explainMistake, type ExplainResult } from "@/lib/ai-data";
import type { DoubtRequest } from "@/lib/ai-doubt";
import { askDoubt, type DoubtResponse } from "@/lib/ai-doubt-data";
import { requireUserId } from "@/lib/current-user";

/** "Why was I wrong?" for one question the signed-in user answered wrongly (docs/adr/0009). */
export async function whyWasIWrong(questionId: number): Promise<ExplainResult> {
  const id = z.number().int().positive().parse(questionId);
  const userId = await requireUserId();
  try {
    return await explainMistake(userId, id);
  } catch (e) {
    console.error("whyWasIWrong failed", e);
    return { ok: false, message: "Couldn't get an AI explanation. Please try again." };
  }
}

/** Ask a doubt about a question whose answer the user has already seen (docs/adr/0010). */
export async function askADoubt(input: DoubtRequest): Promise<DoubtResponse> {
  const userId = await requireUserId();
  try {
    return await askDoubt(userId, input);
  } catch (e) {
    console.error("askADoubt failed", e);
    return { ok: false, message: "Couldn't answer that. Please try again." };
  }
}
