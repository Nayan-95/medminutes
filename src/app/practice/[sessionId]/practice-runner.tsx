"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { formatScore } from "@/lib/format";
import type { PracticeQuestion, RecordedAttempt } from "@/lib/practice";
import { OPTIONS, type Option } from "@/lib/scoring";

import { finishSession, submitAnswer } from "../actions";

interface Props {
  sessionId: string;
  questions: PracticeQuestion[];
  initialAttempts: RecordedAttempt[];
}

const RESULT_LABEL = {
  correct: "Correct",
  wrong: "Wrong",
  skipped: "Skipped",
} as const;

export function PracticeRunner({ sessionId, questions, initialAttempts }: Props) {
  const [attempts, setAttempts] = useState(
    () => new Map(initialAttempts.map((a) => [a.questionId, a])),
  );
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
  }, [attempt, pending, isLast, sessionId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (!attempt) {
        const pick = { "1": "A", "2": "B", "3": "C", "4": "D", a: "A", b: "B", c: "C", d: "D" }[key];
        if (pick) setSelected(pick as Option);
        else if (key === "s") answer(null);
        else if (key === "enter" && selected) answer(selected);
      } else if (key === "enter") {
        next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [attempt, selected, answer, next]);

  if (!question) {
    return <p>This session has no questions.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
        <span>
          Question {index + 1} of {questions.length} · {question.subject}
        </span>
        <span className="tabular-nums">
          Session score <strong className="text-base text-zinc-900 dark:text-zinc-100">{formatScore(sessionScore)}</strong>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="h-full bg-emerald-600 transition-all"
          style={{ width: `${(attempts.size / questions.length) * 100}%` }}
        />
      </div>

      <article className="rounded-xl border border-zinc-200 p-6 shadow-sm dark:border-zinc-800">
        <h1 className="text-lg font-medium leading-relaxed whitespace-pre-line">{question.question}</h1>

        <div className="mt-6 flex flex-col gap-3" role="radiogroup" aria-label="Options">
          {OPTIONS.map((opt, i) => {
            const isCorrect = attempt?.correctOption === opt;
            const isPicked = attempt ? attempt.selectedOption === opt : selected === opt;
            let style = "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500";
            if (attempt) {
              if (isCorrect) style = "border-emerald-600 bg-emerald-50 dark:bg-emerald-950";
              else if (isPicked) style = "border-red-600 bg-red-50 dark:bg-red-950";
              else style = "border-zinc-200 opacity-60 dark:border-zinc-800";
            } else if (isPicked) {
              style = "border-sky-600 bg-sky-50 dark:bg-sky-950";
            }
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={isPicked}
                disabled={!!attempt || pending}
                onClick={() => setSelected(opt)}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-default ${style}`}
              >
                <span className="font-mono text-sm text-zinc-500">{i + 1}</span>
                <span className="font-semibold">{opt}.</span>
                <span className="flex-1">{question.options[opt]}</span>
                {attempt && isCorrect && <span aria-label="correct answer">✓</span>}
                {attempt && isPicked && !isCorrect && <span aria-label="your answer">✗</span>}
              </button>
            );
          })}
        </div>

        {attempt && (
          <div className="mt-6 rounded-lg bg-zinc-100 p-4 dark:bg-zinc-900" aria-live="polite">
            <p className="font-semibold">
              {RESULT_LABEL[attempt.result]} · {formatScore(attempt.points)}
              {attempt.result !== "correct" && <> · Answer: {attempt.correctOption}</>}
            </p>
            {attempt.explanation ? (
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-zinc-700 dark:text-zinc-300">
                {attempt.explanation}
              </p>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">No explanation available for this question.</p>
            )}
          </div>
        )}
      </article>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        {!attempt ? (
          <>
            <button
              type="button"
              onClick={() => selected && answer(selected)}
              disabled={!selected || pending}
              className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "Checking…" : "Submit"}
            </button>
            <button
              type="button"
              onClick={() => answer(null)}
              disabled={pending}
              className="rounded-lg border border-zinc-300 px-6 py-3 font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Skip (0)
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={next}
            disabled={pending}
            className="rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isLast ? (pending ? "Finishing…" : "Finish session") : "Next question"}
          </button>
        )}
        <span className="ml-auto hidden text-xs text-zinc-500 sm:block">
          Keys: 1–4 choose · Enter submit/next · S skip
        </span>
      </div>
    </div>
  );
}
