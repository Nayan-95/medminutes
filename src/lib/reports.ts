import { z } from "zod";

/** Question reports (docs/adr/0008): the rules, kept free of the database so they can be unit-tested. */

export const REPORT_REASONS = ["wrong_answer", "wrong_explanation", "typo", "unclear", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "fixed", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REASON_LABEL: Record<ReportReason, string> = {
  wrong_answer: "Wrong answer key",
  wrong_explanation: "Wrong or misleading explanation",
  typo: "Typo or garbled text",
  unclear: "Unclear or missing information",
  other: "Something else",
};

export const NOTE_MAX = 500;

export const reportSchema = z
  .object({
    questionId: z.number().int().positive(),
    reason: z.enum(REPORT_REASONS),
    note: z
      .string()
      .trim()
      .max(NOTE_MAX, `Keep the note under ${NOTE_MAX} characters.`)
      .transform((s) => (s === "" ? null : s))
      .nullish()
      .transform((s) => s ?? null),
  })
  // "Something else" means nothing without a few words saying what.
  .refine((r) => r.reason !== "other" || r.note !== null, {
    message: "Tell us what's wrong.",
    path: ["note"],
  });

export type ReportInput = z.input<typeof reportSchema>;

/**
 * Admins come from the ADMIN_EMAILS env var (comma-separated). Missing or empty
 * means nobody is an admin, so a build or deploy without it is locked, not open.
 */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

export function isAdminEmail(email: string | null | undefined, raw = process.env.ADMIN_EMAILS): boolean {
  if (!email) return false;
  return parseAdminEmails(raw).has(email.trim().toLowerCase());
}
