"use server";

import { z } from "zod";

import { explainMistake, type ExplainResult } from "@/lib/ai-data";
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
