"use client";

import { CircleCheck, LoaderCircle, TriangleAlert } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { reportQuestion } from "@/app/report-actions";
import { buttonVariants } from "@/components/ui/button";
import { NOTE_MAX, REASON_LABEL, REPORT_REASONS, type ReportReason } from "@/lib/reports";
import { cn } from "@/lib/utils";

/**
 * "Report a problem" for a question whose answer the student has seen (docs/adr/0008).
 * Collapsed by default; opens an inline form (reason + optional note). Keyboard
 * shortcuts of the page are switched off inside it via data-no-shortcuts.
 */
export function ReportQuestion({ questionId, initiallyReported = false, className }: { questionId: number; initiallyReported?: boolean; className?: string }) {
  const [state, setState] = useState<"idle" | "open" | "sent">(initiallyReported ? "sent" : "idle");
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = useId();

  if (state === "sent") {
    return (
      <p className={cn("inline-flex items-center gap-1.5 text-sm text-muted-foreground", className)} data-testid="report-sent" role="status">
        <CircleCheck className="size-4" aria-hidden />
        Reported. Thanks, we&apos;ll check this question.
      </p>
    );
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={() => setState("open")}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 text-muted-foreground", className)}
      >
        <TriangleAlert aria-hidden />
        Report a problem
      </button>
    );
  }

  const needsNote = reason === "other" && note.trim() === "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason || needsNote) return;
    setError(null);
    startTransition(async () => {
      const res = await reportQuestion({ questionId, reason, note }).catch(() => ({
        ok: false as const,
        error: "Couldn't send the report. Check your connection and try again.",
      }));
      if (res.ok) setState("sent");
      else setError(res.error);
    });
  }

  return (
    <form
      onSubmit={submit}
      data-no-shortcuts
      data-testid="report-form"
      aria-labelledby={`${id}-title`}
      className={cn("animate-rise rounded-xl border bg-card p-4", className)}
    >
      <h3 id={`${id}-title`} className="text-sm font-semibold">
        What&apos;s wrong with this question?
      </h3>
      <fieldset className="mt-3 flex flex-wrap gap-2">
        <legend className="sr-only">Reason</legend>
        {REPORT_REASONS.map((r) => (
          <label
            key={r}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              reason === r ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            <input type="radio" name={`${id}-reason`} value={r} checked={reason === r} onChange={() => setReason(r)} className="sr-only" />
            {REASON_LABEL[r]}
          </label>
        ))}
      </fieldset>
      <label htmlFor={`${id}-note`} className="mt-4 block text-sm font-medium">
        Details <span className="font-normal text-muted-foreground">{reason === "other" ? "(required)" : "(optional)"}</span>
      </label>
      <textarea
        id={`${id}-note`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={NOTE_MAX}
        rows={3}
        placeholder="For example: the answer should be C because…"
        className="mt-1.5 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums" aria-hidden>
        {note.length}/{NOTE_MAX}
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-wrong-soft px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={!reason || needsNote || pending} className={buttonVariants({ size: "lg" })}>
          {pending && <LoaderCircle className="animate-spin" aria-hidden />}
          {pending ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={() => setState("idle")} disabled={pending} className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Cancel
        </button>
      </div>
    </form>
  );
}
