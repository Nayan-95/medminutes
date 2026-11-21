"use client";

import { AlarmClock, ArrowLeft, ArrowRight, CloudOff, Eraser, Flag, LayoutGrid, LoaderCircle, Lock, Send, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { SubjectIcon, subjectLabel } from "@/components/subject-icon";
import { buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { formatCountdown, mockClock, paletteStatus, sectionOf, type MockFormat, type PaletteStatus } from "@/lib/mock";
import type { PracticeQuestion } from "@/lib/practice";
import { OPTIONS, type Option } from "@/lib/scoring";
import { cn } from "@/lib/utils";

import { saveMockResponses, submitMock, type SaveMockInput } from "../actions";

type Shape = Pick<MockFormat, "sectionCount" | "sectionSize" | "sectionSeconds">;
type Resp = { selectedOption: Option | null; firstOption: Option | null; markedForReview: boolean };
const EMPTY: Resp = { selectedOption: null, firstOption: null, markedForReview: false };
type Patch = SaveMockInput["patches"][number];

interface Props {
  sessionId: string;
  format: Shape & { label: string };
  startedAt: number;
  serverNow: number;
  questions: PracticeQuestion[];
  initialResponses: (Resp & { questionId: number })[];
}

const STATUS_LABEL: Record<PaletteStatus, string> = {
  "not-visited": "Not visited",
  "not-answered": "Not answered",
  answered: "Answered",
  marked: "Marked for review",
  "answered-marked": "Answered and marked",
};

/** Status is shown by fill, border style and a flag, never by colour alone. */
function statusClass(status: PaletteStatus) {
  return cn(
    "relative grid place-items-center rounded-lg border text-xs font-semibold tabular-nums",
    status === "not-visited" && "border-transparent bg-muted text-muted-foreground",
    status === "not-answered" && "border-dashed border-foreground/50 bg-card",
    (status === "answered" || status === "answered-marked") && "border-foreground bg-foreground text-background",
    status === "marked" && "border-brand bg-card text-foreground",
  );
}

function MarkedFlag({ status }: { status: PaletteStatus }) {
  if (status !== "marked" && status !== "answered-marked") return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-brand text-brand-foreground ring-2 ring-card">
      <Flag className="size-2.5" aria-hidden />
    </span>
  );
}

function PaletteCell({ n, status, current, onClick }: { n: number; status: PaletteStatus; current: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "step" : undefined}
      aria-label={`Question ${n}, ${STATUS_LABEL[status].toLowerCase()}`}
      data-status={status}
      className={cn(
        statusClass(status),
        "h-9 transition-colors outline-none hover:border-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
        current && "ring-2 ring-ring ring-offset-2 ring-offset-card",
      )}
    >
      {n}
      <MarkedFlag status={status} />
    </button>
  );
}

function LegendItem({ status, count }: { status: PaletteStatus; count: number }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className={cn(statusClass(status), "size-6 shrink-0")} aria-hidden>
        <MarkedFlag status={status} />
      </span>
      <span className="flex-1 text-muted-foreground">{STATUS_LABEL[status]}</span>
      <span className="font-medium tabular-nums">{count}</span>
    </li>
  );
}

export function ExamRunner({ sessionId, format: f, startedAt, serverNow, questions, initialResponses }: Props) {
  const start = useMemo(() => new Date(startedAt), [startedAt]);
  // Server clock minus client clock; refined after every save.
  const offset = useRef(0);
  const [now, setNow] = useState(serverNow);
  const clock = mockClock(start, f, new Date(now));
  const section = clock.state === "running" ? clock.section : f.sectionCount - 1;

  const [responses, setResponses] = useState(() => new Map(initialResponses.map((r) => [r.questionId, { selectedOption: r.selectedOption, firstOption: r.firstOption, markedForReview: r.markedForReview }])));
  const [index, setIndex] = useState(() => {
    const first = Math.min(clock.state === "running" ? clock.section : 0, f.sectionCount - 1) * f.sectionSize;
    const done = new Set(initialResponses.filter((r) => r.selectedOption).map((r) => r.questionId));
    for (let i = first; i < Math.min(first + f.sectionSize, questions.length); i++) if (!done.has(questions[i].id)) return i;
    return first;
  });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const question = questions[index];
  const current = question ? responses.get(question.id) : undefined;
  const sectionStart = section * f.sectionSize;
  const sectionEnd = Math.min(sectionStart + f.sectionSize, questions.length) - 1;
  const isLastSection = section === f.sectionCount - 1;

  // ---- Saving: patches are merged per question and sent one batch at a time, in order.
  const pending = useRef(new Map<number, Patch>());
  const inFlight = useRef(false);
  const retry = useRef<number | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    flushRef.current = async function flush() {
      if (inFlight.current || pending.current.size === 0) return;
      inFlight.current = true;
      const batch = [...pending.current.values()];
      pending.current.clear();
      setSaveState("saving");
      const sent = Date.now();
      let failed = false;
      try {
        const res = await saveMockResponses({ sessionId, patches: batch });
        offset.current = res.serverNow - (sent + Date.now()) / 2;
        setSaveState("idle");
      } catch {
        failed = true;
        // Put the batch back (newer state for the same question wins) and retry shortly.
        for (const p of batch) {
          const newer = pending.current.get(p.questionId);
          pending.current.set(p.questionId, newer ? { ...newer, timeDeltaMs: newer.timeDeltaMs + p.timeDeltaMs } : p);
        }
        setSaveState("error");
        if (retry.current === null) {
          retry.current = window.setTimeout(() => {
            retry.current = null;
            void flush();
          }, 3000);
        }
      } finally {
        inFlight.current = false;
      }
      // Changes made while this batch was in flight go next (after a failure, the timer retries).
      if (!failed && pending.current.size > 0) void flush();
    };
    void flushRef.current();
  }, [sessionId]);

  const queue = useCallback((questionId: number, state: Resp, timeDeltaMs = 0) => {
    const prev = pending.current.get(questionId);
    pending.current.set(questionId, { questionId, ...state, timeDeltaMs: (prev?.timeDeltaMs ?? 0) + Math.max(0, Math.round(timeDeltaMs)) });
    void flushRef.current();
  }, []);

  // ---- Time on each question: counted while it is on screen.
  const shownAt = useRef(0);
  const responsesRef = useRef(responses);
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  useEffect(() => {
    if (!question) return;
    shownAt.current = Date.now();
    const id = question.id;
    // Opening a question marks it visited.
    const state = responsesRef.current.get(id) ?? EMPTY;
    if (!responsesRef.current.has(id)) setResponses((m) => new Map(m).set(id, state));
    queue(id, state, 0);
    return () => {
      // Leaving it: record the time spent, with its latest state.
      queue(id, responsesRef.current.get(id) ?? state, Date.now() - shownAt.current);
    };
  }, [question, queue]);

  const update = useCallback(
    (change: Partial<Resp>) => {
      if (!question || clock.state !== "running" || sectionOf(index, f.sectionSize) !== section) return;
      const prev = responses.get(question.id) ?? EMPTY;
      const next = { ...prev, ...change };
      next.firstOption = prev.firstOption ?? next.selectedOption;
      setResponses((m) => new Map(m).set(question.id, next));
      queue(question.id, next, Date.now() - shownAt.current);
      shownAt.current = Date.now();
    },
    [question, clock.state, index, f.sectionSize, section, responses, queue],
  );

  const goTo = useCallback(
    (i: number) => {
      if (i < sectionStart || i > sectionEnd) return;
      setIndex(i);
      setPaletteOpen(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [sectionStart, sectionEnd],
  );

  // ---- Clock: tick every second; move to the next section or submit when time runs out.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => window.clearInterval(id);
  }, []);

  const [shownSection, setShownSection] = useState(section);
  if (shownSection !== section) {
    setShownSection(section);
    if (clock.state === "running") {
      setIndex(section * f.sectionSize);
      setNotice(`Section ${section} is closed. Section ${section + 1} of ${f.sectionCount} has started.`);
    }
  }

  const submit = useCallback(() => {
    startSubmit(async () => {
      // Send the time on the open question, wait for saves to finish, then submit.
      if (question) queue(question.id, responsesRef.current.get(question.id) ?? EMPTY, Date.now() - shownAt.current);
      shownAt.current = Date.now();
      for (let i = 0; i < 20 && (inFlight.current || pending.current.size > 0); i++) {
        await new Promise((r) => setTimeout(r, 150));
      }
      setSubmitError(null);
      try {
        await submitMock(sessionId); // redirects to the result page
      } catch {
        setSubmitError("Couldn't submit. Check your connection and try again; your saved answers are safe.");
      }
    });
  }, [question, queue, sessionId]);

  // Time's up: submit once by itself; the dialog stays open so a failed submit can be retried.
  const timeUp = clock.state === "over";
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (!timeUp || autoSubmitted.current) return;
    autoSubmitted.current = true;
    setConfirmOpen(true);
    submit();
  }, [timeUp, submit]);

  // ---- Keyboard: 1–4 / A–D choose, M mark, ← → move within the section.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || confirmOpen) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      const key = e.key.toLowerCase();
      const pick = { "1": "A", "2": "B", "3": "C", "4": "D", a: "A", b: "B", c: "C", d: "D" }[key];
      if (pick) update({ selectedOption: pick as Option });
      else if (key === "m") update({ markedForReview: !current?.markedForReview });
      else if (key === "arrowright") goTo(index + 1);
      else if (key === "arrowleft") goTo(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [update, goTo, index, current, confirmOpen]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (pending.current.size > 0 || inFlight.current) e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  if (!question) return <p className="text-muted-foreground">This mock has no questions.</p>;

  const sectionLeft = clock.state === "running" ? clock.sectionEndsAt.getTime() - now : 0;
  const examLeft = clock.state === "running" ? clock.examEndsAt.getTime() - now : 0;
  const lowTime = sectionLeft <= 5 * 60_000;

  const counts = (from: number, to: number) => {
    const c: Record<PaletteStatus, number> = { "not-visited": 0, "not-answered": 0, answered: 0, marked: 0, "answered-marked": 0 };
    for (let i = from; i <= to; i++) c[paletteStatus(responses.get(questions[i].id))] += 1;
    return c;
  };
  const sectionCounts = counts(sectionStart, sectionEnd);
  const allCounts = counts(0, questions.length - 1);
  const answeredAll = allCounts.answered + allCounts["answered-marked"];

  const palette = (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">Section {section + 1}</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {sectionCounts.answered + sectionCounts["answered-marked"]}/{sectionEnd - sectionStart + 1} answered
        </span>
      </div>
      <div className="grid grid-cols-6 gap-2 pt-1.5 pr-1.5" data-testid="palette">
        {questions.slice(sectionStart, sectionEnd + 1).map((q, k) => {
          const i = sectionStart + k;
          return <PaletteCell key={q.id} n={i + 1} status={paletteStatus(responses.get(q.id))} current={i === index} onClick={() => goTo(i)} />;
        })}
      </div>
      <ul className="grid gap-2 border-t pt-4 text-xs">
        {(["answered", "not-answered", "marked", "answered-marked", "not-visited"] as const).map((s) => (
          <LegendItem key={s} status={s} count={sectionCounts[s]} />
        ))}
      </ul>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 pb-32 lg:pb-0">
      {/* Exam bar: sections, timers, submit */}
      <div className="sticky top-14 z-30 -mx-4 border-b bg-background/90 px-4 py-2.5 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ol className="flex items-center gap-1" aria-label="Sections">
            {Array.from({ length: f.sectionCount }, (_, s) => (
              <li
                key={s}
                aria-current={s === section ? "step" : undefined}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-medium tabular-nums",
                  s === section ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                )}
              >
                {s < section && <Lock className="size-3" aria-label="closed" />}
                <span>
                  <span className="sr-only sm:not-sr-only">Section </span>
                  {s + 1}
                </span>
              </li>
            ))}
          </ol>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground tabular-nums md:inline" title="Time left in the whole exam">
              Exam {formatCountdown(examLeft)}
            </span>
            <span
              data-testid="section-timer"
              role="timer"
              aria-label={`Time left in section ${section + 1}`}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold tabular-nums", lowTime ? "border-wrong/40 bg-wrong-soft" : "bg-card")}
            >
              <AlarmClock className={cn("size-4", lowTime ? "text-wrong" : "text-muted-foreground")} aria-hidden />
              {formatCountdown(sectionLeft)}
              {lowTime && <span className="text-xs font-medium">left</span>}
            </span>
            <button type="button" onClick={() => setConfirmOpen(true)} disabled={submitting} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <Send data-icon="inline-start" aria-hidden />
              Submit
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <p role="status" className="flex items-start gap-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-card" data-testid="section-notice">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="flex-1">{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
        {/* Question */}
        <article key={question.id} className="animate-rise rounded-xl border bg-card p-5 shadow-card sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium tabular-nums" data-testid="question-counter">
              Question {index + 1} <span className="text-muted-foreground">of {questions.length}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <SubjectIcon name={question.subject} className="size-3.5" />
              {subjectLabel(question.subject)}
            </span>
          </div>
          <h1 className="mt-4 text-lg leading-relaxed font-medium whitespace-pre-line sm:text-xl sm:leading-relaxed">{question.question}</h1>

          <div className="mt-6 flex flex-col gap-2.5" role="radiogroup" aria-label="Options">
            {OPTIONS.map((opt, i) => {
              const picked = current?.selectedOption === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  role="radio"
                  aria-checked={picked}
                  onClick={() => update({ selectedOption: opt })}
                  className={cn(
                    "group flex items-start gap-3 rounded-lg border bg-card p-3.5 text-left transition-all outline-none sm:p-4",
                    "focus-visible:ring-3 focus-visible:ring-ring/50",
                    picked ? "border-foreground ring-1 ring-foreground" : "hover:border-foreground/25 hover:bg-muted/50",
                  )}
                >
                  <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg border text-xs font-semibold", picked && "border-foreground bg-foreground text-background")}>{opt}</span>
                  <span className="flex-1 pt-0.5 leading-relaxed">{question.options[opt]}</span>
                  <Kbd className="mt-0.5 hidden opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex">{i + 1}</Kbd>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {current?.markedForReview && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 font-medium text-brand-foreground" data-testid="marked-chip">
                <Flag className="size-3" aria-hidden /> Marked for review
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1.5" aria-live="polite" data-testid="save-state">
              {saveState === "saving" && (
                <>
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Saving…
                </>
              )}
              {saveState === "error" && (
                <>
                  <CloudOff className="size-3.5" aria-hidden /> Not saved yet, retrying…
                </>
              )}
              {saveState === "idle" && "All answers saved"}
            </span>
          </div>
        </article>

        {/* Palette: side panel on large screens */}
        <aside className="hidden rounded-xl border bg-card p-4 shadow-card lg:sticky lg:top-32 lg:block" aria-label="Question palette">
          {palette}
        </aside>
      </div>

      {/* Actions: sticky on phones and tablets, inline on large screens */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 px-4 py-3 backdrop-blur-xl lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <button type="button" onClick={() => goTo(index - 1)} disabled={index <= sectionStart} aria-label="Previous question" className={buttonVariants({ variant: "outline", size: "xl" })}>
            <ArrowLeft aria-hidden />
            <span className="hidden sm:inline">Previous</span>
          </button>
          <button
            type="button"
            onClick={() => update({ markedForReview: !current?.markedForReview })}
            aria-pressed={!!current?.markedForReview}
            className={cn(buttonVariants({ variant: "outline", size: "xl" }), current?.markedForReview && "border-brand")}
          >
            <Flag aria-hidden className={cn(current?.markedForReview && "text-brand")} />
            <span className="hidden sm:inline">{current?.markedForReview ? "Unmark" : "Mark for review"}</span>
            <span className="sm:hidden">{current?.markedForReview ? "Unmark" : "Mark"}</span>
          </button>
          <button
            type="button"
            onClick={() => update({ selectedOption: null })}
            disabled={!current?.selectedOption}
            className={cn(buttonVariants({ variant: "ghost", size: "xl" }), "hidden sm:inline-flex")}
          >
            <Eraser aria-hidden />
            Clear
          </button>
          <button type="button" onClick={() => setPaletteOpen(true)} className={cn(buttonVariants({ variant: "outline", size: "xl" }), "lg:hidden")} aria-label="Question palette">
            <LayoutGrid aria-hidden />
          </button>
          <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground xl:flex">
            <Kbd>1</Kbd>–<Kbd>4</Kbd> choose <Kbd>M</Kbd> mark <Kbd>←</Kbd>
            <Kbd>→</Kbd> move
          </span>
          {index < sectionEnd ? (
            <button type="button" onClick={() => goTo(index + 1)} className={cn(buttonVariants({ size: "xl" }), "ml-auto flex-1 sm:min-w-28 sm:flex-none xl:ml-0")}>
              Next
              <ArrowRight data-icon="inline-end" aria-hidden />
            </button>
          ) : isLastSection ? (
            <button type="button" onClick={() => setConfirmOpen(true)} className={cn(buttonVariants({ size: "xl" }), "ml-auto flex-1 sm:min-w-28 sm:flex-none xl:ml-0")}>
              <Send data-icon="inline-start" aria-hidden />
              Submit
            </button>
          ) : (
            <span className="ml-auto min-w-0 max-w-56 text-right text-xs text-muted-foreground xl:ml-0" data-testid="section-end-hint">
              End of section {section + 1}. Section {section + 2} opens in {formatCountdown(sectionLeft)}.
            </span>
          )}
        </div>
      </div>

      {/* Palette sheet on phones and tablets */}
      {paletteOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 lg:hidden" onClick={() => setPaletteOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Question palette" className="max-h-[80vh] w-full animate-rise overflow-y-auto rounded-t-2xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex justify-end">
              <button type="button" aria-label="Close" autoFocus onClick={() => setPaletteOpen(false)} className={buttonVariants({ variant: "ghost", size: "icon" })}>
                <X />
              </button>
            </div>
            {palette}
          </div>
        </div>
      )}

      {/* Submit confirmation (and the time-up state) */}
      {(confirmOpen || submitting) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="submit-title" className="w-full max-w-md animate-rise rounded-xl border bg-card p-6 shadow-float">
            <h2 id="submit-title" className="text-lg font-semibold">
              {timeUp ? "Time's up" : "Submit the mock?"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {timeUp
                ? "Your answers are being submitted."
                : isLastSection
                  ? "You can't change answers after submitting."
                  : `Sections ${section + 1}–${f.sectionCount} will close now, and you can't change answers after submitting.`}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm" data-testid="submit-summary">
              {[
                ["Answered", answeredAll],
                ["Not answered", allCounts["not-answered"] + allCounts.marked],
                ["Marked for review", allCounts.marked + allCounts["answered-marked"]],
                ["Not visited", allCounts["not-visited"]],
              ].map(([label, n]) => (
                <div key={label} className="rounded-lg border bg-background/50 px-3 py-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{n}</dd>
                </div>
              ))}
            </dl>
            {submitError && (
              <p role="alert" className="mt-4 rounded-lg bg-wrong-soft px-3 py-2 text-sm">
                {submitError}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {!submitting && !timeUp && (
                <button type="button" autoFocus onClick={() => setConfirmOpen(false)} className={buttonVariants({ variant: "outline", size: "xl" })}>
                  Keep going
                </button>
              )}
              <button type="button" onClick={submit} disabled={submitting} className={buttonVariants({ size: "xl" })}>
                {submitting ? <LoaderCircle className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                {submitting ? "Submitting…" : "Submit mock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
