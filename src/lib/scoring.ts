export const OPTIONS = ["A", "B", "C", "D"] as const;
export type Option = (typeof OPTIONS)[number];
export type AttemptResult = "correct" | "wrong" | "skipped";

/** NEET PG marking scheme. Mirrored by the `attempts_scoring_ck` database constraint. */
export const MARKS: Record<AttemptResult, number> = {
  correct: 4,
  wrong: -1,
  skipped: 0,
};

export function scoreAnswer(
  selected: Option | null,
  correct: Option,
): { result: AttemptResult; points: number } {
  const result: AttemptResult =
    selected === null ? "skipped" : selected === correct ? "correct" : "wrong";
  return { result, points: MARKS[result] };
}

export interface ScoreSummary {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  /** Correct ÷ attempted (skips excluded). Null when nothing was attempted. */
  accuracy: number | null;
}

export function summarise(results: readonly AttemptResult[]): ScoreSummary {
  const counts = { correct: 0, wrong: 0, skipped: 0 };
  for (const r of results) counts[r] += 1;
  const attempted = counts.correct + counts.wrong;
  return {
    ...counts,
    total: counts.correct * MARKS.correct + counts.wrong * MARKS.wrong,
    accuracy: attempted === 0 ? null : counts.correct / attempted,
  };
}
