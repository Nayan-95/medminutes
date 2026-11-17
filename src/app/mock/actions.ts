"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUserId } from "@/lib/current-user";
import { canSave, mockClock } from "@/lib/mock";
import { createMock, finalizeExpiredMocks, finalizeMock, getMockSession, listMocks, upsertResponses } from "@/lib/mock-data";
import { OPTIONS } from "@/lib/scoring";

export async function startMock(formData: FormData) {
  const format = z.enum(["full", "mini"]).parse(formData.get("format"));
  const userId = await requireUserId("/mock");
  // One mock at a time: if one is still running, go back to it.
  await finalizeExpiredMocks(userId);
  const running = (await listMocks(userId)).find((m) => !m.endedAt);
  if (running) redirect(`/mock/${running.id}`);
  const id = await createMock(userId, format);
  redirect(`/mock/${id}`);
}

const saveSchema = z.object({
  sessionId: z.uuid(),
  patches: z
    .array(
      z.object({
        questionId: z.number().int().positive(),
        selectedOption: z.enum(OPTIONS).nullable(),
        firstOption: z.enum(OPTIONS).nullable(),
        markedForReview: z.boolean(),
        timeDeltaMs: z.number().int().min(0),
      }),
    )
    .max(200),
});

export type SaveMockInput = z.input<typeof saveSchema>;

export interface SaveMockResult {
  /** Questions whose section is closed (or not open yet); their changes were not saved. */
  rejected: number[];
  /** True once the whole exam's time is up. */
  over: boolean;
  serverNow: number;
}

/**
 * Saves the current state of one or more questions. Changes to questions
 * outside the open section are refused, so the clock is enforced on the server.
 */
export async function saveMockResponses(raw: SaveMockInput): Promise<SaveMockResult> {
  const input = saveSchema.parse(raw);
  const userId = await requireUserId();
  const row = await getMockSession(input.sessionId, userId);
  if (!row) throw new Error("Mock not found.");
  const now = new Date();
  const over = !!row.session.endedAt || mockClock(row.session.startedAt, row.mock, now).state === "over";

  const indexOf = new Map(row.session.questionIds.map((id, i) => [id, i]));
  const maxDelta = row.mock.sectionSeconds * 1000;
  const accepted = [];
  const rejected: number[] = [];
  for (const p of input.patches) {
    const index = indexOf.get(p.questionId);
    if (!row.session.endedAt && index !== undefined && canSave(index, row.session.startedAt, row.mock, now)) {
      accepted.push({ ...p, timeDeltaMs: Math.min(p.timeDeltaMs, maxDelta) });
    } else rejected.push(p.questionId);
  }
  await upsertResponses(input.sessionId, accepted, now);
  return { rejected, over, serverNow: now.getTime() };
}

/** Ends the mock (user pressed Submit, or time ran out) and shows the result. */
export async function submitMock(sessionId: string) {
  const id = z.uuid().parse(sessionId);
  const userId = await requireUserId();
  await finalizeMock(id, userId);
  revalidatePath("/", "layout"); // lifetime score, progress, due counts
  redirect(`/mock/${id}/result`);
}
