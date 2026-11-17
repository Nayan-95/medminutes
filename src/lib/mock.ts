/**
 * Mock exam rules: pure functions only (no database), so they are unit-tested.
 * See docs/adr/0007-mock-exams.md.
 */
import { MARKS, scoreAnswer, type AttemptResult, type Option } from "./scoring";

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------

export interface MockFormat {
  id: "full" | "mini";
  label: string;
  sectionCount: number;
  sectionSize: number;
  sectionSeconds: number;
}

/**
 * NEET PG 2026 (NBEMS bulletin, July 2026): 180 MCQs in 5 time-bound sections
 * of 36 questions and 42 minutes each, 3 h 30 min in all. The mini mock keeps
 * the same pace (70 s per question) at a quarter of the length.
 */
export const MOCK_FORMATS = {
  full: { id: "full", label: "Full mock", sectionCount: 5, sectionSize: 36, sectionSeconds: 42 * 60 },
  mini: { id: "mini", label: "Mini mock", sectionCount: 5, sectionSize: 9, sectionSeconds: 10.5 * 60 },
} as const satisfies Record<string, MockFormat>;

export type MockFormatId = keyof typeof MOCK_FORMATS;

export const totalQuestions = (f: Pick<MockFormat, "sectionCount" | "sectionSize">) => f.sectionCount * f.sectionSize;
export const totalSeconds = (f: Pick<MockFormat, "sectionCount" | "sectionSeconds">) => f.sectionCount * f.sectionSeconds;

/** Answers that arrive this long after a section closes are still accepted (network delay). */
export const SAVE_GRACE_MS = 15_000;

// ---------------------------------------------------------------------------
// Subject blueprint
// ---------------------------------------------------------------------------

/**
 * Approximate share of NEET PG questions per subject, from published analyses
 * of recent papers. NBEMS publishes no official split, so treat these as
 * relative weights, not exact counts. Keys are MedMCQA subject names.
 */
export const SUBJECT_WEIGHTS: Record<string, number> = {
  Medicine: 22,
  Surgery: 21,
  "Gynaecology & Obstetrics": 17,
  "Social & Preventive Medicine": 16,
  Pathology: 15,
  Pharmacology: 14,
  Microbiology: 13,
  Anatomy: 12,
  Physiology: 11,
  Biochemistry: 10,
  Pediatrics: 8,
  ENT: 8,
  Ophthalmology: 8,
  "Forensic Medicine": 8,
  Orthopaedics: 6,
  Skin: 4,
  Psychiatry: 4,
  Anaesthesia: 4,
  Radiology: 4,
};

/**
 * Splits `total` questions across subjects in proportion to their weights
 * (largest-remainder method), never asking a subject for more than it has.
 * Any shortfall goes to the subjects with spare questions, heaviest first.
 */
export function allocateBySubject(
  subjects: readonly { id: number; name: string; available: number }[],
  total: number,
  weights: Record<string, number> = SUBJECT_WEIGHTS,
): Map<number, number> {
  const pool = subjects.filter((s) => (weights[s.name] ?? 0) > 0 && s.available > 0);
  const weightSum = pool.reduce((n, s) => n + weights[s.name], 0);
  const out = new Map<number, number>();
  if (pool.length === 0 || total <= 0) return out;

  const exact = pool.map((s) => ({ s, q: (total * weights[s.name]) / weightSum }));
  for (const { s, q } of exact) out.set(s.id, Math.min(Math.floor(q), s.available));
  let left = total - [...out.values()].reduce((a, b) => a + b, 0);

  // Largest remainders first, then heaviest subjects; ties by name for stability.
  const order = [...exact].sort(
    (a, b) => b.q - Math.floor(b.q) - (a.q - Math.floor(a.q)) || weights[b.s.name] - weights[a.s.name] || a.s.name.localeCompare(b.s.name),
  );
  while (left > 0) {
    let gave = false;
    for (const { s } of order) {
      if (left === 0) break;
      const n = out.get(s.id)!;
      if (n < s.available) {
        out.set(s.id, n + 1);
        left -= 1;
        gave = true;
      }
    }
    if (!gave) break; // the whole bank is smaller than the mock
  }
  for (const [id, n] of out) if (n === 0) out.delete(id);
  return out;
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

export type MockClock =
  | { state: "running"; section: number; sectionEndsAt: Date; examEndsAt: Date }
  | { state: "over"; examEndsAt: Date };

/**
 * Where the exam stands at `now`. Sections run back to back from the start and
 * cannot be finished early or reopened, as in NEET PG, so the clock alone
 * decides the current section.
 */
export function mockClock(startedAt: Date, f: Pick<MockFormat, "sectionCount" | "sectionSeconds">, now: Date): MockClock {
  const sectionMs = f.sectionSeconds * 1000;
  const examEndsAt = new Date(startedAt.getTime() + f.sectionCount * sectionMs);
  const elapsed = now.getTime() - startedAt.getTime();
  if (elapsed >= f.sectionCount * sectionMs) return { state: "over", examEndsAt };
  const section = Math.max(0, Math.floor(elapsed / sectionMs));
  return { state: "running", section, sectionEndsAt: new Date(startedAt.getTime() + (section + 1) * sectionMs), examEndsAt };
}

/** The section (0-based) that question number `index` (0-based) belongs to. */
export const sectionOf = (index: number, sectionSize: number) => Math.floor(index / sectionSize);

/**
 * Whether an answer to the question at `index` can still be saved: its section
 * is the current one, or closed less than SAVE_GRACE_MS ago.
 */
export function canSave(index: number, startedAt: Date, f: Pick<MockFormat, "sectionCount" | "sectionSize" | "sectionSeconds">, now: Date): boolean {
  const section = sectionOf(index, f.sectionSize);
  if (section < 0 || section >= f.sectionCount) return false;
  const opens = startedAt.getTime() + section * f.sectionSeconds * 1000;
  const closes = opens + f.sectionSeconds * 1000 + SAVE_GRACE_MS;
  return now.getTime() >= opens && now.getTime() < closes;
}

// ---------------------------------------------------------------------------
// Question palette (NBEMS-style statuses)
// ---------------------------------------------------------------------------

export type PaletteStatus = "not-visited" | "not-answered" | "answered" | "marked" | "answered-marked";

export function paletteStatus(r: { selectedOption: Option | null; markedForReview: boolean } | undefined): PaletteStatus {
  if (!r) return "not-visited";
  if (r.selectedOption) return r.markedForReview ? "answered-marked" : "answered";
  return r.markedForReview ? "marked" : "not-answered";
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface MockQuestionResult {
  questionId: number;
  index: number;
  subject: string;
  correctOption: Option;
  /** Undefined when the question was never opened. */
  response?: { selectedOption: Option | null; firstOption: Option | null; markedForReview: boolean; timeSpentMs: number };
}

export type Outcome = AttemptResult | "not-visited";

export const outcomeOf = (q: MockQuestionResult): Outcome =>
  q.response ? scoreAnswer(q.response.selectedOption, q.correctOption).result : "not-visited";

interface Tally {
  correct: number;
  wrong: number;
  skipped: number;
  notVisited: number;
  score: number;
}

const emptyTally = (): Tally => ({ correct: 0, wrong: 0, skipped: 0, notVisited: 0, score: 0 });

function add(t: Tally, o: Outcome) {
  if (o === "not-visited") t.notVisited += 1;
  else {
    t[o] += 1;
    t.score += MARKS[o];
  }
}

export const accuracyOf = (t: Pick<Tally, "correct" | "wrong">) => (t.correct + t.wrong === 0 ? null : t.correct / (t.correct + t.wrong));

export interface MockAnalysis extends Tally {
  max: number;
  accuracy: number | null;
  /** Marks lost to negative marking (one per wrong answer). */
  negativeMarks: number;
  sections: (Tally & { section: number; timeSpentMs: number })[];
  /** Weakest first (by accuracy, among subjects with answers), then the rest. */
  subjects: (Tally & { subject: string; accuracy: number | null })[];
  changes: { rightToWrong: number; wrongToRight: number; wrongToWrong: number };
  marked: { answered: number; correct: number; unanswered: number };
  timeSpentMs: number;
  /** Average time on questions answered, in ms; null when none. */
  avgAnswerMs: number | null;
}

export function analyseMock(questions: readonly MockQuestionResult[], sectionSize: number): MockAnalysis {
  const total = emptyTally();
  const sections = new Map<number, Tally & { section: number; timeSpentMs: number }>();
  const subjects = new Map<string, Tally>();
  const changes = { rightToWrong: 0, wrongToRight: 0, wrongToWrong: 0 };
  const marked = { answered: 0, correct: 0, unanswered: 0 };
  let timeSpentMs = 0;
  let answeredMs = 0;

  for (const q of questions) {
    const o = outcomeOf(q);
    add(total, o);
    const s = sectionOf(q.index, sectionSize);
    if (!sections.has(s)) sections.set(s, { ...emptyTally(), section: s, timeSpentMs: 0 });
    const st = sections.get(s)!;
    add(st, o);
    if (!subjects.has(q.subject)) subjects.set(q.subject, emptyTally());
    add(subjects.get(q.subject)!, o);

    const r = q.response;
    if (!r) continue;
    timeSpentMs += r.timeSpentMs;
    st.timeSpentMs += r.timeSpentMs;
    if (r.selectedOption) answeredMs += r.timeSpentMs;
    if (r.firstOption && r.selectedOption && r.firstOption !== r.selectedOption) {
      const wasRight = r.firstOption === q.correctOption;
      const isRight = r.selectedOption === q.correctOption;
      if (wasRight && !isRight) changes.rightToWrong += 1;
      else if (!wasRight && isRight) changes.wrongToRight += 1;
      else changes.wrongToWrong += 1;
    }
    if (r.markedForReview) {
      if (r.selectedOption) {
        marked.answered += 1;
        if (r.selectedOption === q.correctOption) marked.correct += 1;
      } else marked.unanswered += 1;
    }
  }

  const subjectRows = [...subjects.entries()].map(([subject, t]) => ({ ...t, subject, accuracy: accuracyOf(t) }));
  subjectRows.sort((a, b) => {
    if (a.accuracy === null || b.accuracy === null) return a.accuracy === null ? (b.accuracy === null ? a.subject.localeCompare(b.subject) : 1) : -1;
    return a.accuracy - b.accuracy || b.correct + b.wrong - (a.correct + a.wrong) || a.subject.localeCompare(b.subject);
  });

  const answered = total.correct + total.wrong;
  return {
    ...total,
    max: questions.length * MARKS.correct,
    accuracy: accuracyOf(total),
    negativeMarks: total.wrong * -MARKS.wrong,
    sections: [...sections.values()].sort((a, b) => a.section - b.section),
    subjects: subjectRows,
    changes,
    marked,
    timeSpentMs,
    avgAnswerMs: answered === 0 ? null : answeredMs / answered,
  };
}

/**
 * Share of other mocks (same format) that scored below `score`, counting ties
 * as half. Null until there are at least `minOthers` to compare against, so a
 * handful of early mocks doesn't produce a misleading number.
 */
export function percentileAmong(score: number, others: readonly number[], minOthers = 10): number | null {
  if (others.length < minOthers) return null;
  let below = 0;
  let ties = 0;
  for (const o of others) {
    if (o < score) below += 1;
    else if (o === score) ties += 1;
  }
  return (below + ties / 2) / others.length;
}

/** "1:05:09" or "4:09": hours only when needed. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
