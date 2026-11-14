/**
 * "Smart mix": which questions a practice session serves. Pure functions only
 * (no database), so every rule is unit-tested. See docs/adr/0005 and
 * research/03-recommendation-engine.md for the evidence behind each number.
 *
 * Vocabulary
 * - unit: a topic, or a subject's untagged questions (half of MedMCQA has no topic).
 * - seen / correct: the user's FIRST attempt at each question in the unit. Later
 *   attempts are FSRS reviews and would double-count mistakes. Skips count as wrong.
 * - shrinkage: with few answers, a unit's accuracy is pulled toward its subject's
 *   (and a subject's toward the user's overall), so 1 wrong out of 2 is not "weak".
 */
import { shuffled, type Rng } from "./random";

export const SMART_MIX = {
  /** Logged on every session so we can compare policies later. Bump when the rules change. */
  policy: "smart-v1",
  /** Aim new questions at this predicted chance of being correct. */
  targetSuccess: 0.75,
  /** Pseudo-answers that pull a unit toward its parent's accuracy. */
  priorStrength: 8,
  /** Starting guess for a brand-new user's accuracy (and the item-difficulty baseline). */
  baselineAccuracy: 0.6,
  /** Share of the session given to due reviews… */
  reviewShare: 0.3,
  /** …raised when the review backlog is large, so fewer new questions pile on. */
  backlogReviewShare: 0.5,
  backlogThreshold: 30,
  /** Unseen topics, so the whole syllabus gets covered. */
  coverageShare: 0.2,
  /** Purely random questions: keep exploring, and keep data honest for evaluation. */
  randomShare: 0.1,
  /** Candidates fetched per weak/coverage pick, to choose the one nearest the target. */
  candidatesPerPick: 4,
  /** Never more than this many likely-wrong questions in a row. */
  maxHardInARow: 2,
  /** A question counts as likely wrong below this predicted chance. */
  hardBelow: 0.6,
} as const;

export type Slot = "review" | "weak" | "coverage" | "random" | "fill";

export interface UnitStats {
  key: string;
  subjectId: number;
  topicId: number | null;
  /** Questions in the unit. */
  total: number;
  /** Distinct questions this user has answered in the unit. */
  seen: number;
  /** How many of those first answers were correct. */
  correct: number;
}

export interface UnitBelief extends UnitStats {
  /** Beta posterior over the user's accuracy in this unit. */
  alpha: number;
  beta: number;
  mean: number;
}

export const unitKey = (subjectId: number, topicId: number | null) => `${subjectId}:${topicId ?? "-"}`;

/** Accuracy with `m` pseudo-answers at `prior` added: (correct + m·prior) / (n + m). */
export function shrink(correct: number, n: number, prior: number, m: number = SMART_MIX.priorStrength): number {
  return (correct + m * prior) / (n + m);
}

/** Overall → subject → unit shrinkage, giving each unit a Beta(α, β) belief. */
export function unitBeliefs(units: readonly UnitStats[]): UnitBelief[] {
  const m = SMART_MIX.priorStrength;
  const sum = (xs: readonly UnitStats[], f: (u: UnitStats) => number) => xs.reduce((n, u) => n + f(u), 0);
  const overall = shrink(sum(units, (u) => u.correct), sum(units, (u) => u.seen), SMART_MIX.baselineAccuracy);

  const bySubject = new Map<number, UnitStats[]>();
  for (const u of units) bySubject.set(u.subjectId, [...(bySubject.get(u.subjectId) ?? []), u]);
  const subjectMean = new Map(
    [...bySubject].map(([id, us]) => [id, shrink(sum(us, (u) => u.correct), sum(us, (u) => u.seen), overall)]),
  );

  return units.map((u) => {
    const prior = subjectMean.get(u.subjectId) ?? overall;
    const alpha = u.correct + m * prior;
    const beta = u.seen - u.correct + m * (1 - prior);
    return { ...u, alpha, beta, mean: alpha / (alpha + beta) };
  });
}

/** How many questions of each kind a session of `count` gets. */
export function planSlots(count: number, due: { inScope: number; total: number }) {
  const share = due.total >= SMART_MIX.backlogThreshold ? SMART_MIX.backlogReviewShare : SMART_MIX.reviewShare;
  const review = Math.min(due.inScope, Math.round(count * share));
  const rest = count - review;
  const random = rest >= 5 ? Math.max(1, Math.round(count * SMART_MIX.randomShare)) : 0;
  const coverage = Math.min(rest - random, Math.round(count * SMART_MIX.coverageShare));
  return { review, weak: rest - random - coverage, coverage, random };
}

// --- Thompson sampling -----------------------------------------------------

function normal(rng: Rng): number {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Gamma(k, 1) sample (Marsaglia–Tsang). */
export function sampleGamma(k: number, rng: Rng): number {
  if (k < 1) {
    let u = 0;
    while (u === 0) u = rng();
    return sampleGamma(k + 1, rng) * Math.pow(u, 1 / k);
  }
  const d = k - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

export function sampleBeta(a: number, b: number, rng: Rng): number {
  const x = sampleGamma(a, rng);
  const y = sampleGamma(b, rng);
  return x / (x + y);
}

/**
 * Picks units for the "weak" slots by Thompson sampling: draw a plausible
 * accuracy for each practised unit and take the lowest. Uncertain units get
 * picked sometimes too, so a topic isn't written off after one good answer.
 * After each pick we pretend the user got it right (as AMBOSS does), so one
 * session spreads across several weak units instead of hammering one.
 * Only units the user has practised qualify; unseen ones are "coverage".
 */
export function pickWeakUnits(beliefs: readonly UnitBelief[], n: number, rng: Rng): Map<string, number> {
  const pool = beliefs
    .filter((u) => u.seen > 0 && u.total > u.seen)
    .map((u) => ({ key: u.key, alpha: u.alpha, beta: u.beta, left: u.total - u.seen }));
  const picks = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    let best: (typeof pool)[number] | null = null;
    let bestDraw = Infinity;
    for (const u of pool) {
      if (u.left <= 0) continue;
      const draw = sampleBeta(u.alpha, u.beta, rng);
      if (draw < bestDraw) [best, bestDraw] = [u, draw];
    }
    if (!best) break;
    picks.set(best.key, (picks.get(best.key) ?? 0) + 1);
    best.alpha += 1;
    best.left -= 1;
  }
  return picks;
}

/**
 * Picks units for "coverage": least-practised first, larger units a bit more
 * often (weight √size / (1 + seen)), one question per unit where possible.
 */
export function pickCoverageUnits(
  units: readonly UnitStats[],
  n: number,
  rng: Rng,
  taken: ReadonlyMap<string, number> = new Map(),
): Map<string, number> {
  const ranked = units
    .map((u) => ({ u, left: u.total - u.seen - (taken.get(u.key) ?? 0) }))
    .filter((x) => x.left > 0)
    .map((x) => ({ ...x, key: Math.pow(rng() || Number.MIN_VALUE, (1 + x.u.seen) / Math.sqrt(x.u.total)) }))
    .sort((a, b) => b.key - a.key);
  const picks = new Map<string, number>();
  let remaining = n;
  while (remaining > 0 && ranked.some((r) => r.left > 0)) {
    for (const r of ranked) {
      if (remaining === 0) break;
      if (r.left <= 0) continue;
      picks.set(r.u.key, (picks.get(r.u.key) ?? 0) + 1);
      r.left -= 1;
      remaining -= 1;
    }
  }
  return picks;
}

// --- Difficulty targeting --------------------------------------------------

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clampP = (p: number) => Math.min(0.99, Math.max(0.01, p));

/**
 * Chance this user answers this question correctly: their accuracy in the
 * unit, shifted by how much easier or harder the question has been for
 * everyone (its shrunk % correct versus the baseline). With no data on the
 * question, it's just the unit accuracy.
 */
export function predictSuccess(unitMean: number, item?: { correct: number; answered: number }): number {
  if (!item || item.answered === 0) return unitMean;
  const base = SMART_MIX.baselineAccuracy;
  const itemP = shrink(item.correct, item.answered, base);
  return sigmoid(logit(clampP(unitMean)) + logit(clampP(itemP)) - logit(base));
}

/** The `n` candidates whose predicted success is nearest the target (stable for ties). */
export function closestToTarget<T extends { p: number }>(candidates: readonly T[], n: number, target: number = SMART_MIX.targetSuccess): T[] {
  return candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => Math.abs(a.c.p - target) - Math.abs(b.c.p - target) || a.i - b.i)
    .slice(0, n)
    .map((x) => x.c);
}

// --- Ordering --------------------------------------------------------------

export interface Pick {
  questionId: number;
  slot: Slot;
  unitKey: string;
  /** Predicted chance of a correct answer. */
  p: number;
}

const isHard = (x: Pick) => x.p < SMART_MIX.hardBelow;

/**
 * Interleaves the session: no unit twice in a row where possible (mixing
 * similar topics helps discrimination), and at most `maxHardInARow`
 * likely-wrong questions back to back, so weak-topic work never feels like a wall.
 */
export function interleave(picks: readonly Pick[], rng: Rng): Pick[] {
  const remaining = shuffled(picks, rng);
  const out: Pick[] = [];
  while (remaining.length > 0) {
    let hardRun = 0;
    for (let i = out.length - 1; i >= 0 && isHard(out[i]); i--) hardRun++;
    const last = out.at(-1);
    const allowedHard = (x: Pick) => !(isHard(x) && hardRun >= SMART_MIX.maxHardInARow);
    let idx = remaining.findIndex((x) => allowedHard(x) && x.unitKey !== last?.unitKey);
    if (idx < 0) idx = remaining.findIndex(allowedHard);
    if (idx < 0) idx = 0;
    out.push(remaining.splice(idx, 1)[0]);
  }
  return out;
}
