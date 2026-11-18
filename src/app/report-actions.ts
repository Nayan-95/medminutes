"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAdminUser, requireUserId } from "@/lib/current-user";
import { REPORT_STATUSES, type ReportInput } from "@/lib/reports";
import { ReportRefused, saveReport, setQuestionReportStatus } from "@/lib/reports-data";

/** A student reports a problem with a question they have answered (docs/adr/0008). */
export async function reportQuestion(input: ReportInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  try {
    await saveReport(userId, input);
    return { ok: true };
  } catch (e) {
    if (e instanceof ReportRefused) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Check the form and try again." };
    console.error("reportQuestion failed", e);
    return { ok: false, error: "Couldn't send the report. Check your connection and try again." };
  }
}

const statusSchema = z.object({
  questionId: z.coerce.number().int().positive(),
  from: z.enum(REPORT_STATUSES),
  to: z.enum(REPORT_STATUSES),
});

/** The owner closes (or reopens) every report on one question. Admins only. */
export async function setReportStatus(formData: FormData) {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Not allowed.");
  const input = statusSchema.parse({
    questionId: formData.get("questionId"),
    from: formData.get("from"),
    to: formData.get("to"),
  });
  await setQuestionReportStatus(input.questionId, input.from, input.to);
  revalidatePath("/admin/reports");
}
