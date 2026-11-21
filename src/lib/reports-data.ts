import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { practiceSessions, questionReports, questions, subjects } from "@/db/schema";
import type { ReportInput, ReportReason, ReportStatus } from "@/lib/reports";
import { reportSchema } from "@/lib/reports";
import type { Option } from "@/lib/scoring";
import { hasSeenAnswer } from "@/lib/seen";
import { cleanOptional, cleanText } from "@/lib/text";

/** Question reports (docs/adr/0008): database access. */

/** A refusal whose message is safe to show the student. */
export class ReportRefused extends Error {}

/** Questions in this session that the user has an open report on (they see "Reported"). */
export async function getOpenReportIdsForSession(userId: string, sessionId: string): Promise<number[]> {
  const rows = await getDb()
    .select({ questionId: questionReports.questionId })
    .from(questionReports)
    .where(
      and(
        eq(questionReports.userId, userId),
        eq(questionReports.status, "open"),
        sql`${questionReports.questionId} = any(
          select unnest(${practiceSessions.questionIds}) from ${practiceSessions}
           where ${practiceSessions.id} = ${sessionId} and ${practiceSessions.userId} = ${userId})`,
      ),
    );
  return rows.map((r) => r.questionId);
}

/**
 * Saves (or updates) this user's report on a question. Only questions whose answer the
 * user has already seen can be reported: ones they answered, or ones in a session that
 * has ended (e.g. a submitted mock). Reporting again replaces the reason and note and
 * reopens a report the owner had closed.
 */
export async function saveReport(userId: string, raw: ReportInput): Promise<void> {
  const input = reportSchema.parse(raw);
  const db = getDb();
  if (!(await hasSeenAnswer(userId, input.questionId))) throw new ReportRefused("You can only report questions you have answered.");

  const now = new Date();
  await db
    .insert(questionReports)
    .values({ userId, questionId: input.questionId, reason: input.reason, note: input.note, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [questionReports.userId, questionReports.questionId],
      set: { reason: input.reason, note: input.note, status: "open", updatedAt: now },
    });
}

export interface ReportGroup {
  questionId: number;
  subject: string;
  question: string;
  options: Record<Option, string>;
  correctOption: Option;
  explanation: string | null;
  /** Newest first. Reporters stay anonymous on the admin page. */
  reports: { reason: ReportReason; note: string | null; at: Date }[];
  lastReportedAt: Date;
}

const GROUP_LIMIT = 50;

/** Reports with this status, grouped by question; questions with the most reports come first. */
export async function listReportGroups(status: ReportStatus): Promise<{ groups: ReportGroup[]; totalQuestions: number }> {
  const db = getDb();
  const top = await db
    .select({
      questionId: questionReports.questionId,
      count: sql<number>`count(*)::int`,
      last: sql<Date>`max(${questionReports.updatedAt})`.mapWith((v) => new Date(v)),
      total: sql<number>`(count(*) over ())::int`,
    })
    .from(questionReports)
    .where(eq(questionReports.status, status))
    .groupBy(questionReports.questionId)
    .orderBy(desc(sql`count(*)`), desc(sql`max(${questionReports.updatedAt})`))
    .limit(GROUP_LIMIT);
  if (top.length === 0) return { groups: [], totalQuestions: 0 };

  const ids = top.map((t) => t.questionId);
  const [qs, reports] = await Promise.all([
    db
      .select({
        id: questions.id,
        question: questions.question,
        a: questions.optionA,
        b: questions.optionB,
        c: questions.optionC,
        d: questions.optionD,
        correctOption: questions.correctOption,
        explanation: questions.explanation,
        subject: subjects.name,
      })
      .from(questions)
      .innerJoin(subjects, eq(subjects.id, questions.subjectId))
      .where(inArray(questions.id, ids)),
    db
      .select({
        questionId: questionReports.questionId,
        reason: questionReports.reason,
        note: questionReports.note,
        at: questionReports.updatedAt,
      })
      .from(questionReports)
      .where(and(eq(questionReports.status, status), inArray(questionReports.questionId, ids)))
      .orderBy(desc(questionReports.updatedAt)),
  ]);

  const byId = new Map(qs.map((q) => [q.id, q]));
  const groups = top.flatMap((t): ReportGroup[] => {
    const q = byId.get(t.questionId);
    if (!q) return [];
    return [
      {
        questionId: q.id,
        subject: q.subject,
        question: cleanText(q.question),
        options: { A: cleanText(q.a), B: cleanText(q.b), C: cleanText(q.c), D: cleanText(q.d) },
        correctOption: q.correctOption,
        explanation: cleanOptional(q.explanation),
        reports: reports.filter((r) => r.questionId === q.id),
        lastReportedAt: t.last,
      },
    ];
  });
  return { groups, totalQuestions: top[0].total };
}

/** How many questions have reports in each status (for the admin tabs). */
export async function countReportedQuestions(): Promise<Record<ReportStatus, number>> {
  const rows = await getDb()
    .select({ status: questionReports.status, n: sql<number>`count(distinct ${questionReports.questionId})::int` })
    .from(questionReports)
    .groupBy(questionReports.status);
  const counts: Record<ReportStatus, number> = { open: 0, fixed: 0, dismissed: 0 };
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

/** Moves every report on a question from one status to another (e.g. open → fixed). */
export async function setQuestionReportStatus(questionId: number, from: ReportStatus, to: ReportStatus): Promise<void> {
  await getDb()
    .update(questionReports)
    .set({ status: to, updatedAt: new Date() })
    .where(and(eq(questionReports.questionId, questionId), eq(questionReports.status, from)));
}
