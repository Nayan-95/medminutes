import { CircleCheck, Inbox, RotateCcw, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { setReportStatus } from "@/app/report-actions";
import { PageHeader } from "@/components/page-header";
import { SubjectIcon, subjectLabel } from "@/components/subject-icon";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminUser } from "@/lib/current-user";
import { REASON_LABEL, REPORT_STATUSES, type ReportReason, type ReportStatus } from "@/lib/reports";
import { countReportedQuestions, listReportGroups, type ReportGroup } from "@/lib/reports-data";
import { OPTIONS } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Question reports — MedMinutes", robots: { index: false } };

const TAB_LABEL: Record<ReportStatus, string> = { open: "Open", fixed: "Fixed", dismissed: "Dismissed" };

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function StatusButton({ questionId, from, to, children, variant = "outline" }: { questionId: number; from: ReportStatus; to: ReportStatus; children: React.ReactNode; variant?: "outline" | "default" | "ghost" }) {
  return (
    <form action={setReportStatus}>
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <button type="submit" className={buttonVariants({ variant, size: "lg" })}>
        {children}
      </button>
    </form>
  );
}

function ReasonSummary({ reports }: { reports: ReportGroup["reports"] }) {
  const counts = new Map<ReportReason, number>();
  for (const r of reports) counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1);
  return (
    <span className="flex flex-wrap gap-1.5">
      {[...counts].map(([reason, n]) => (
        <span key={reason} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          {REASON_LABEL[reason]}
          {n > 1 && <span className="tabular-nums"> × {n}</span>}
        </span>
      ))}
    </span>
  );
}

function GroupCard({ g, status }: { g: ReportGroup; status: ReportStatus }) {
  return (
    <li className="rounded-xl border bg-card p-5 shadow-card sm:p-6" data-testid="report-group" data-question-id={g.questionId}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium">
          <SubjectIcon name={g.subject} className="size-3.5" />
          {subjectLabel(g.subject)}
        </span>
        <span className="tabular-nums">Question #{g.questionId}</span>
        <span>·</span>
        <span className="tabular-nums">
          {g.reports.length} {g.reports.length === 1 ? "report" : "reports"}, last {when.format(g.lastReportedAt)}
        </span>
      </div>

      <p className="mt-3 leading-relaxed font-medium whitespace-pre-line">{g.question}</p>
      <ul className="mt-3 grid gap-1.5 text-sm">
        {OPTIONS.map((opt) => (
          <li key={opt} className={cn("flex gap-2 rounded-lg px-3 py-2", opt === g.correctOption ? "bg-correct-soft" : "bg-muted/50")}>
            <span className="font-semibold">{opt}.</span>
            <span className="flex-1">{g.options[opt]}</span>
            {opt === g.correctOption && (
              <span className="inline-flex items-center gap-1 text-xs font-medium">
                <CircleCheck className="size-4 text-correct" aria-hidden />
                Answer key
              </span>
            )}
          </li>
        ))}
      </ul>
      <details className="group mt-3">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Explanation</summary>
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{g.explanation ?? "No explanation."}</p>
      </details>

      <div className="mt-4 border-t pt-4">
        <ReasonSummary reports={g.reports} />
        {g.reports.some((r) => r.note) && (
          <ul className="mt-3 flex flex-col gap-2">
            {g.reports
              .filter((r) => r.note)
              .map((r, i) => (
                <li key={i} className="rounded-lg border-l-2 bg-muted/40 px-3 py-2 text-sm">
                  <p className="whitespace-pre-line">{r.note}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {REASON_LABEL[r.reason]} · {when.format(r.at)}
                  </p>
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {status === "open" ? (
          <>
            <StatusButton questionId={g.questionId} from="open" to="fixed" variant="default">
              <CircleCheck aria-hidden />
              Mark fixed
            </StatusButton>
            <StatusButton questionId={g.questionId} from="open" to="dismissed">
              <X aria-hidden />
              Dismiss
            </StatusButton>
          </>
        ) : (
          <StatusButton questionId={g.questionId} from={status} to="open">
            <RotateCcw aria-hidden />
            Reopen
          </StatusButton>
        )}
      </div>
    </li>
  );
}

async function Reports({ searchParams }: { searchParams: PageProps<"/admin/reports">["searchParams"] }) {
  await connection();
  // Not an admin (or signed out): the page doesn't exist for you.
  if (!(await getAdminUser())) notFound();

  const raw = (await searchParams).status;
  const status: ReportStatus = typeof raw === "string" && (REPORT_STATUSES as readonly string[]).includes(raw) ? (raw as ReportStatus) : "open";
  const [{ groups, totalQuestions }, counts] = await Promise.all([listReportGroups(status), countReportedQuestions()]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Question reports"
        description={
          <>
            Problems students flagged after answering. Fix the question in the database (<code className="font-mono text-xs">npm run db:studio</code>, table{" "}
            <code className="font-mono text-xs">questions</code>), then mark it fixed. Reporters stay anonymous here.
          </>
        }
      />

      <nav className="flex flex-wrap gap-1" aria-label="Report status">
        {REPORT_STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "open" ? "/admin/reports" : `/admin/reports?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={cn("rounded-full px-3 py-1.5 text-sm font-medium tabular-nums", s === status ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
          >
            {TAB_LABEL[s]} {counts[s]}
          </Link>
        ))}
      </nav>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
          <Inbox className="size-6 text-muted-foreground" aria-hidden />
          <p className="font-medium">Nothing here</p>
          <p className="text-sm text-muted-foreground">{status === "open" ? "No open reports. Nice." : `No ${TAB_LABEL[status].toLowerCase()} reports yet.`}</p>
        </div>
      ) : (
        <>
          {totalQuestions > groups.length && (
            <p className="text-sm text-muted-foreground">
              Showing the {groups.length} most-reported of {totalQuestions} questions.
            </p>
          )}
          <ol className="flex flex-col gap-4">
            {groups.map((g) => (
              <GroupCard key={g.questionId} g={g} status={status} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
}

export default function AdminReportsPage(props: PageProps<"/admin/reports">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4" aria-label="Loading reports">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-[320px] w-full rounded-xl" />
        </div>
      }
    >
      <Reports searchParams={props.searchParams} />
    </Suspense>
  );
}
