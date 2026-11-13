"use client";

import { ArrowRight, CircleCheck, CircleMinus, CircleX, Flag, LoaderCircle, Timer, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { ScorePill } from "@/components/score-pill";
import { SubjectIcon, subjectLabel } from "@/components/subject-icon";
import { buttonVariants } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { formatScore } from "@/lib/format";
import type { PracticeQuestion, RecordedAttempt } from "@/lib/practice";
import { OPTIONS, type AttemptResult, type Option } from "@/lib/scoring";
import { cn } from "@/lib/utils";

import { finishSession, submitAnswer } from "../actions";

interface Props {
  sessionId: string;
  questions: PracticeQuestion[];
  initialAttempts: RecordedAttempt[];
}

const RESULT_UI: Record<AttemptResult, { label: string; Icon: typeof CircleCheck; tone: string }> = {
  correct: { label: "Correct", Icon: CircleCheck, tone: "text-correct" },
  wrong: { label: "Wrong", Icon: CircleX, tone: "text-wrong" },
  skipped: { label: "Skipped", Icon: CircleMinus, tone: "text-muted-foreground" },
};

const SEGMENT: Record<AttemptResult, string> = {
  correct: "bg-correct",
  wrong: "bg-wrong",
  skipped: "bg-skipped",
};

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Seconds since the current question appeared; stops once it is answered. */
function QuestionTimer({ running, resetKey }: { running: boolean; resetKey: number }) {
  const [seconds, setSeconds] = useState(0);
  const [lastKey, setLastKey] = useState(resetKey);
  if (lastKey !== resetKey) {
    setLastKey(resetKey);
    setSeconds(0);
  }
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [running, resetKey]);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums" aria-label="Time on this question">
      <Timer className="size-3.5" aria-hidden />
      {formatClock(seconds)}
    </span>
  );
}

export function PracticeRunner({ sessionId, questions, initialAttempts }: Props) {
  const [attempts, setAttempts] = useState(() => new Map(initialAttempts.map((a) => [a.questionId, a])));
  const [index, setIndex] = useState(() => {
    const done = new Set(initialAttempts.map((a) => a.questionId));
    const first = questions.findIndex((q) => !done.has(q.id));
    return first === -1 ? questions.length - 1 : first;
  });
  const [selected, setSelected] = useState<Option | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const shownAt = useRef(0);

  const question = questions[index];
  const attempt = question ? attempts.get(question.id) : undefined;
  const isLast = index === questions.length - 1;
  const sessionScore = [...attempts.values()].reduce((n, a) => n + a.points, 0);

  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  const answer = useCallback(
    (option: Option | null) => {
      if (!question || attempt || pending) return;
      setError(null);
      startTransition(async () => {
        try {
          const recorded = await submitAnswer({
            sessionId,
            questionId: question.id,
            selectedOption: option,
            timeTakenMs: Math.max(0, Date.now() - shownAt.current),
          });
          setAttempts((prev) => new Map(prev).set(recorded.questionId, recorded));
        } catch {
          setError("Couldn't save your answer. Check your connection and try again.");
        }
      });
    },
    [question, attempt, pending, sessionId],
  );

  const next = useCallback(() => {
    if (!attempt || pending) return;
    if (isLast) {
      startTransition(() => finishSession(sessionId));
      return;
    }
    setSelected(null);
    setIndex((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [attempt, pending, isLast, sessionId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      const key = e.key.toLowerCase();
      if (!attempt) {
        const pick = { "1": "A", "2": "B", "3": "C", "4": "D", a: "A", b: "B", c: "C", d: "D" }[key];
        if (pick) setSelected(pick as Option);
        else if (key === "s") answer(null);
        else if (key === "enter" && selected) {
          e.preventDefault();
          answer(selected);
        }
      } else if (key === "enter") {
        e.preventDefault();
        next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attempt, selected, answer, next]);

  if (!question) {
    return <p className="text-muted-foreground">This session has no questions.</p>;
  }

  const result = attempt ? RESULT_UI[attempt.result] : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-28 sm:pb-0">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/practice"
            aria-label="Leave session"
            title="Leave (progress is saved)"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-muted-foreground")}
          >
            <X />
          </Link>
          <span className="text-sm font-medium tabular-nums" data-testid="question-counter">
            Question {index + 1} <span className="text-muted-foreground">of {questions.length}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <QuestionTimer running={!attempt} resetKey={index} />
          <span data-testid="session-score">
            <ScorePill value={sessionScore} label="Score" />
          </span>
        </div>
      </div>

      {/* Progress: one segment per question, coloured by result */}
      <ol className="flex gap-[2px]" aria-label="Progress">
        {questions.map((q, i) => {
          const a = attempts.get(q.id);
          return (
            <li
              key={q.id}
              aria-label={`Question ${i + 1}: ${a ? RESULT_UI[a.result].label : i === index ? "current" : "not answered"}`}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                a ? SEGMENT[a.result] : i === index ? "bg-foreground/70" : "bg-border",
              )}
            />
          );
        })}
      </ol>

      {/* Question */}
      <article key={question.id} className="animate-rise rounded-2xl border bg-card p-5 shadow-card sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <SubjectIcon name={question.subject} className="size-3.5" />
          {subjectLabel(question.subject)}
        </span>
        <h1 className="mt-4 text-lg leading-relaxed font-medium whitespace-pre-line sm:text-xl sm:leading-relaxed">
          {question.question}
        </h1>

        <div className="mt-6 flex flex-col gap-2.5" role="radiogroup" aria-label="Options">
          {OPTIONS.map((opt, i) => {
            const isCorrect = attempt?.correctOption === opt;
            const isPicked = attempt ? attempt.selectedOption === opt : selected === opt;
            const revealedCorrect = !!attempt && isCorrect;
            const revealedWrong = !!attempt && isPicked && !isCorrect;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={isPicked}
                disabled={!!attempt || pending}
                onClick={() => setSelected(opt)}
                className={cn(
                  "group flex items-start gap-3 rounded-xl border bg-card p-3.5 text-left transition-all outline-none sm:p-4",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
                  !attempt && !isPicked && "hover:border-foreground/25 hover:bg-muted/50",
                  !attempt && isPicked && "border-foreground ring-1 ring-foreground",
                  revealedCorrect && "border-correct bg-correct-soft",
                  revealedCorrect && attempt?.selectedOption === opt && "animate-pop",
                  revealedWrong && "animate-shake border-wrong bg-wrong-soft",
                  attempt && !revealedCorrect && !revealedWrong && "opacity-50",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg border text-xs font-semibold transition-colors",
                    !attempt && isPicked && "border-foreground bg-foreground text-background",
                    revealedCorrect && "border-correct bg-correct text-white",
                    revealedWrong && "border-wrong bg-wrong text-white",
                  )}
                >
                  {opt}
                </span>
                <span className="flex-1 pt-0.5 leading-relaxed">{question.options[opt]}</span>
                {revealedCorrect && <CircleCheck className="mt-0.5 size-5 shrink-0 text-correct" aria-label="Correct answer" />}
                {revealedWrong && <CircleX className="mt-0.5 size-5 shrink-0 text-wrong" aria-label="Your answer" />}
                {!attempt && (
                  <Kbd className="mt-0.5 hidden opacity-0 transition-opacity group-hover:opacity-100 sm:inline-flex">
                    {i + 1}
                  </Kbd>
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        <div aria-live="polite">
          {attempt && result && (
            <section
              data-testid="feedback"
              data-result={attempt.result}
              data-points={attempt.points}
              className="mt-6 animate-rise rounded-xl border bg-muted/50 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={cn("inline-flex items-center gap-1.5 font-semibold", result.tone)}>
                  <result.Icon className="size-5" aria-hidden />
                  <span className="text-foreground">{result.label}</span>
                </span>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums">
                  {formatScore(attempt.points)}
                </span>
                {attempt.result !== "correct" && (
                  <span className="text-sm text-muted-foreground">
                    Answer: <span className="font-semibold text-foreground">{attempt.correctOption}</span>
                  </span>
                )}
              </div>
              {attempt.explanation ? (
                <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  <span className="font-medium text-foreground">Explanation · </span>
                  {attempt.explanation}
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No explanation available for this question.</p>
              )}
            </section>
          )}
        </div>
      </article>

      {error && (
        <p role="alert" className="rounded-lg bg-wrong-soft px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {/* Actions: sticky on phones, inline on larger screens */}
      <div data-sticky-actions className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/85 px-4 py-3 backdrop-blur-xl sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          {!attempt ? (
            <>
              <button
                type="button"
                onClick={() => answer(null)}
                disabled={pending}
                className={cn(buttonVariants({ variant: "outline", size: "xl" }), "flex-1 sm:flex-none")}
              >
                Skip (0)
              </button>
              <button
                type="button"
                onClick={() => selected && answer(selected)}
                disabled={!selected || pending}
                className={cn(buttonVariants({ size: "xl" }), "flex-[2] sm:flex-none sm:min-w-36")}
              >
                {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                {pending ? "Checking…" : "Submit"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={pending}
              autoFocus
              className={cn(buttonVariants({ size: "xl" }), "flex-1 sm:flex-none sm:min-w-44")}
            >
              {isLast ? (
                <>
                  {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <Flag aria-hidden />}
                  {pending ? "Finishing…" : "Finish session"}
                </>
              ) : (
                <>
                  Next question
                  <ArrowRight data-icon="inline-end" aria-hidden />
                </>
              )}
            </button>
          )}
          <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
            {attempt ? (
              <>
                <Kbd>Enter</Kbd> {isLast ? "finish" : "next"}
              </>
            ) : (
              <>
                <Kbd>1</Kbd>–<Kbd>4</Kbd> choose <Kbd>Enter</Kbd> submit <Kbd>S</Kbd> skip
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
