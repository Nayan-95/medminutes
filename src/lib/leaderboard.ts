/**
 * Leaderboard rules (pure; see docs/adr/0006). Scores use NEET PG marking, so a
 * careless high-volume player can still fall behind a careful one.
 */
import { APP_TIME_ZONE, dayKey } from "./streak";

export type Window = "week" | "all";

/** Answers needed before someone appears on the accuracy board. */
export const MIN_FOR_ACCURACY = { all: 50, subject: 20 } as const;
/** Answers needed both before and during this week to count as "improved". */
export const MIN_FOR_IMPROVEMENT = 20;
export const TOP_N = 25;

export interface Totals {
  score: number;
  correct: number;
  wrong: number;
  /** Includes skips. */
  answered: number;
}

export interface Row extends Totals {
  userId: string;
  name: string | null;
  email: string | null;
  streak: number;
}

export interface Ranked extends Row {
  rank: number;
}

/** "Priya Sharma" → "Priya S."; one word stays as is; no name → the email's local part. */
export function shortName(name: string | null, email: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return email?.split("@")[0] ?? "Aspirant";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts.at(-1)!.charAt(0).toUpperCase()}.`;
}

/** Accuracy as in the rest of the app: correct / (correct + wrong); skips don't count. */
export function accuracy(t: Pick<Totals, "correct" | "wrong">): number | null {
  return t.correct + t.wrong === 0 ? null : t.correct / (t.correct + t.wrong);
}

/** Monday 00:00 in IST for the week containing `now`, as an instant. */
export function weekStart(now: Date): Date {
  const today = dayKey(now, APP_TIME_ZONE);
  const d = new Date(`${today}T00:00:00Z`);
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return new Date(`${d.toISOString().slice(0, 10)}T00:00:00+05:30`);
}

/**
 * Sorted by score, then more correct answers, then fewer answers (same score
 * with less guessing ranks higher). Equal scores share a rank (1, 2, 2, 4).
 * Only people who answered something are ranked.
 */
export function rankByScore(rows: readonly Row[]): Ranked[] {
  const sorted = rows
    .filter((r) => r.answered > 0)
    .sort((a, b) => b.score - a.score || b.correct - a.correct || a.answered - b.answered || a.userId.localeCompare(b.userId));
  return sorted.map((r, i) => {
    let rank = i + 1;
    if (i > 0 && sorted[i - 1].score === r.score) {
      // Walk back to the first row with this score.
      let j = i;
      while (j > 0 && sorted[j - 1].score === r.score) j--;
      rank = j + 1;
    }
    return { ...r, rank };
  });
}

export interface Standing {
  rank: number;
  of: number;
  /** Share of other ranked people with a lower score, 0–1 (null when you're the only one). */
  aheadOf: number | null;
  /** The person just above you and the points needed to pass them. */
  next: { row: Ranked; gap: number } | null;
  /** Up to `around` people either side of you, you included. */
  neighbours: Ranked[];
}

export function standing(ranked: readonly Ranked[], userId: string, around = 2): Standing | null {
  const i = ranked.findIndex((r) => r.userId === userId);
  if (i < 0) return null;
  const me = ranked[i];
  const others = ranked.length - 1;
  const below = ranked.filter((r) => r.score < me.score).length;
  const above = ranked.slice(0, i).filter((r) => r.score > me.score).at(-1) ?? null;
  return {
    rank: me.rank,
    of: ranked.length,
    aheadOf: others === 0 ? null : below / others,
    // Passing means strictly more points, so +1 over their score.
    next: above ? { row: above, gap: above.score - me.score + 1 } : null,
    neighbours: ranked.slice(Math.max(0, i - around), i + around + 1),
  };
}

/** Most accurate among people with at least `min` answers (ties: more answers first). */
export function accuracyBoard(rows: readonly Row[], min: number, limit = 10): (Row & { accuracy: number })[] {
  return rows
    .filter((r) => r.correct + r.wrong >= min)
    .map((r) => ({ ...r, accuracy: accuracy(r)! }))
    .sort((a, b) => b.accuracy - a.accuracy || b.answered - a.answered)
    .slice(0, limit);
}

export interface Improvement {
  row: Row;
  before: number;
  after: number;
  delta: number;
}

/** Biggest gain in accuracy this week versus everything before it (only gains count). */
export function mostImproved(
  thisWeek: readonly Row[],
  before: ReadonlyMap<string, Pick<Totals, "correct" | "wrong">>,
  min = MIN_FOR_IMPROVEMENT,
  limit = 5,
): Improvement[] {
  const out: Improvement[] = [];
  for (const row of thisWeek) {
    const b = before.get(row.userId);
    if (!b || b.correct + b.wrong < min || row.correct + row.wrong < min) continue;
    const prev = accuracy(b)!;
    const now = accuracy(row)!;
    if (now > prev) out.push({ row, before: prev, after: now, delta: now - prev });
  }
  return out.sort((a, b) => b.delta - a.delta).slice(0, limit);
}
