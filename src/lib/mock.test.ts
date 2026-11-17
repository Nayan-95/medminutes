import { describe, expect, it } from "vitest";

import {
  allocateBySubject,
  analyseMock,
  canSave,
  formatCountdown,
  MOCK_FORMATS,
  mockClock,
  paletteStatus,
  percentileAmong,
  SAVE_GRACE_MS,
  SUBJECT_WEIGHTS,
  totalQuestions,
  totalSeconds,
  type MockQuestionResult,
} from "./mock";

const start = new Date("2026-11-17T03:30:00Z");
const at = (ms: number) => new Date(start.getTime() + ms);
const MIN = 60_000;

describe("formats", () => {
  it("full mock matches NEET PG 2026: 180 questions, 5 × 36, 42 min each, 3 h 30 min", () => {
    const f = MOCK_FORMATS.full;
    expect(totalQuestions(f)).toBe(180);
    expect(f.sectionSize).toBe(36);
    expect(f.sectionSeconds).toBe(42 * 60);
    expect(totalSeconds(f)).toBe(210 * 60);
  });

  it("mini mock keeps the real pace of 70 s per question", () => {
    const f = MOCK_FORMATS.mini;
    expect(totalQuestions(f)).toBe(45);
    expect(f.sectionSeconds / f.sectionSize).toBe(70);
    expect(MOCK_FORMATS.full.sectionSeconds / MOCK_FORMATS.full.sectionSize).toBe(70);
  });
});

describe("allocateBySubject", () => {
  const all = Object.keys(SUBJECT_WEIGHTS).map((name, i) => ({ id: i + 1, name, available: 10_000 }));
  const sum = (m: Map<number, number>) => [...m.values()].reduce((a, b) => a + b, 0);

  it("fills exactly the requested total, in proportion to the weights", () => {
    const m = allocateBySubject(all, 180);
    expect(sum(m)).toBe(180);
    const medicine = all.find((s) => s.name === "Medicine")!.id;
    const radiology = all.find((s) => s.name === "Radiology")!.id;
    // 22/205 × 180 ≈ 19.3 and 4/205 × 180 ≈ 3.5
    expect(m.get(medicine)).toBe(19);
    expect([3, 4]).toContain(m.get(radiology));
  });

  it("works for the mini mock too", () => {
    expect(sum(allocateBySubject(all, 45))).toBe(45);
  });

  it("never asks a subject for more than it has and moves the shortfall elsewhere", () => {
    const small = all.map((s) => (s.name === "Medicine" ? { ...s, available: 2 } : s));
    const m = allocateBySubject(small, 180);
    expect(m.get(small.find((s) => s.name === "Medicine")!.id)).toBe(2);
    expect(sum(m)).toBe(180);
  });

  it("ignores subjects without a weight (e.g. Dental) and returns less when the bank is too small", () => {
    const m = allocateBySubject([{ id: 1, name: "Anatomy", available: 3 }, { id: 2, name: "Dental", available: 99 }], 10);
    expect([...m.entries()]).toEqual([[1, 3]]);
  });
});

describe("mockClock", () => {
  const f = MOCK_FORMATS.full;

  it("starts in section 0 and moves on every 42 minutes", () => {
    expect(mockClock(start, f, at(0))).toMatchObject({ state: "running", section: 0, sectionEndsAt: at(42 * MIN) });
    expect(mockClock(start, f, at(42 * MIN - 1))).toMatchObject({ section: 0 });
    expect(mockClock(start, f, at(42 * MIN))).toMatchObject({ section: 1, sectionEndsAt: at(84 * MIN) });
    expect(mockClock(start, f, at(209 * MIN))).toMatchObject({ section: 4 });
  });

  it("is over after 3 h 30 min", () => {
    expect(mockClock(start, f, at(210 * MIN))).toEqual({ state: "over", examEndsAt: at(210 * MIN) });
  });

  it("treats a clock slightly behind the start as section 0", () => {
    expect(mockClock(start, f, at(-500))).toMatchObject({ state: "running", section: 0 });
  });
});

describe("canSave", () => {
  const f = MOCK_FORMATS.mini; // 9 per section, 630 s each

  it("accepts answers only in the open section", () => {
    expect(canSave(0, start, f, at(1000))).toBe(true);
    expect(canSave(8, start, f, at(1000))).toBe(true);
    expect(canSave(9, start, f, at(1000))).toBe(false); // section 2 not open yet
  });

  it("allows a short grace period after a section closes, then locks it", () => {
    const closes = 630_000;
    expect(canSave(0, start, f, at(closes + SAVE_GRACE_MS - 1))).toBe(true);
    expect(canSave(0, start, f, at(closes + SAVE_GRACE_MS))).toBe(false);
    expect(canSave(9, start, f, at(closes))).toBe(true);
  });

  it("rejects indexes outside the exam", () => {
    expect(canSave(-1, start, f, at(0))).toBe(false);
    expect(canSave(45, start, f, at(5 * 630_000 - 1))).toBe(false);
  });
});

describe("paletteStatus", () => {
  it("maps responses to NBEMS-style statuses", () => {
    expect(paletteStatus(undefined)).toBe("not-visited");
    expect(paletteStatus({ selectedOption: null, markedForReview: false })).toBe("not-answered");
    expect(paletteStatus({ selectedOption: "A", markedForReview: false })).toBe("answered");
    expect(paletteStatus({ selectedOption: null, markedForReview: true })).toBe("marked");
    expect(paletteStatus({ selectedOption: "B", markedForReview: true })).toBe("answered-marked");
  });
});

describe("analyseMock", () => {
  const r = (selectedOption: "A" | "B" | "C" | "D" | null, extra: Partial<NonNullable<MockQuestionResult["response"]>> = {}) => ({
    selectedOption,
    firstOption: selectedOption,
    markedForReview: false,
    timeSpentMs: 10_000,
    ...extra,
  });
  // Section size 2. Correct answer is always A.
  const qs: MockQuestionResult[] = [
    { questionId: 1, index: 0, subject: "Anatomy", correctOption: "A", response: r("A") },
    { questionId: 2, index: 1, subject: "Anatomy", correctOption: "A", response: r("B", { firstOption: "A" }) }, // right → wrong
    { questionId: 3, index: 2, subject: "Medicine", correctOption: "A", response: r("A", { firstOption: "C", markedForReview: true }) }, // wrong → right, marked
    { questionId: 4, index: 3, subject: "Medicine", correctOption: "A", response: r(null, { markedForReview: true }) }, // marked, unanswered
    { questionId: 5, index: 4, subject: "Surgery", correctOption: "A" }, // never opened
  ];
  const a = analyseMock(qs, 2);

  it("scores with +4 / −1 / 0 and counts unopened questions separately", () => {
    expect(a).toMatchObject({ correct: 2, wrong: 1, skipped: 1, notVisited: 1, score: 7, max: 20, negativeMarks: 1 });
    expect(a.accuracy).toBeCloseTo(2 / 3);
  });

  it("splits by section with time spent", () => {
    expect(a.sections.map((s) => [s.section, s.score, s.timeSpentMs])).toEqual([
      [0, 3, 20_000],
      [1, 4, 20_000],
      [2, 0, 0],
    ]);
  });

  it("orders subjects weakest first, unanswered subjects last", () => {
    expect(a.subjects.map((s) => s.subject)).toEqual(["Anatomy", "Medicine", "Surgery"]);
  });

  it("finds changed answers and marked-for-review outcomes", () => {
    expect(a.changes).toEqual({ rightToWrong: 1, wrongToRight: 1, wrongToWrong: 0 });
    expect(a.marked).toEqual({ answered: 1, correct: 1, unanswered: 1 });
  });

  it("averages time over answered questions only", () => {
    expect(a.timeSpentMs).toBe(40_000);
    expect(a.avgAnswerMs).toBe(10_000);
  });
});

describe("percentileAmong", () => {
  it("is null until there are enough mocks to compare with", () => {
    expect(percentileAmong(100, [1, 2, 3])).toBeNull();
  });

  it("counts lower scores and half of the ties", () => {
    const others = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentileAmong(55, others)).toBe(0.5);
    expect(percentileAmong(50, others)).toBe(0.45);
    expect(percentileAmong(1000, others)).toBe(1);
  });
});

describe("formatCountdown", () => {
  it("shows hours only when needed and never goes negative", () => {
    expect(formatCountdown(42 * MIN)).toBe("42:00");
    expect(formatCountdown(210 * MIN)).toBe("3:30:00");
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(-5000)).toBe("0:00");
  });
});
