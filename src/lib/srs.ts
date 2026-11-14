import {
  computeDecayFactor,
  createEmptyCard,
  default_w,
  forgetting_curve,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type Grade,
  type State,
} from "ts-fsrs";

import type { AttemptResult } from "./scoring";

/**
 * Spaced repetition with FSRS (ts-fsrs 5.x, FSRS-6 model). See docs/adr/0004.
 *
 * - Long-term scheduling only (no minute-level relearning steps): re-showing an
 *   MCQ minutes later tests short-term memory of the answer, not learning.
 * - Intervals capped at a year, a sensible horizon for exam preparation.
 * - Fuzz spreads reviews so cards learned together don't all fall due together.
 */
export const scheduler = fsrs(
  generatorParameters({
    request_retention: 0.9,
    maximum_interval: 365,
    enable_fuzz: true,
    enable_short_term: false,
  }),
);

/** MCQ outcome → FSRS grade. Wrong or skipped means "didn't know it". */
export function gradeFor(result: AttemptResult): Grade {
  return result === "correct" ? Rating.Good : Rating.Again;
}

/** The card after answering, starting from `card` (or a new card on first sight). */
export function schedule(card: Card | null, result: AttemptResult, now: Date): Card {
  return scheduler.next(card ?? createEmptyCard(now), now, gradeFor(result)).card;
}

/** Rebuild a card by replaying a question's answers in order (attempts are the source of truth). */
export function replay(history: readonly { result: AttemptResult; at: Date }[]): Card | null {
  let card: Card | null = null;
  for (const h of history) card = schedule(card, h.result, h.at);
  return card;
}

/** Database row shape for `review_cards` (minus the user/question keys). */
export interface CardRow {
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: Date | null;
}

export function toRow(card: Card): CardRow {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ?? null,
  };
}

export function fromRow(row: CardRow): Card {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsedDays,
    scheduled_days: row.scheduledDays,
    learning_steps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.lastReview ?? undefined,
  };
}

/**
 * FSRS-6 forgetting curve, R = (1 + factor · t / S)^decay, with the default
 * weights our scheduler uses. Exposed as constants so SQL can sort by it.
 */
export const FORGETTING_CURVE = computeDecayFactor(default_w);

/** Chance the user still remembers a card `elapsedDays` after its last review. */
export function retrievability(stability: number, elapsedDays: number): number {
  return forgetting_curve(default_w, Math.max(0, elapsedDays), stability);
}

/** "tomorrow", "in 3 days", "in 2 months" — for "you'll see this again …". */
export function describeNextReview(due: Date, now: Date): string {
  const days = Math.max(1, Math.round((due.getTime() - now.getTime()) / 86_400_000));
  if (days === 1) return "tomorrow";
  if (days < 45) return `in ${days} days`;
  const months = Math.round(days / 30);
  return months < 12 ? `in ${months} months` : "in about a year";
}
