import { describe, expect, it } from "vitest";

import { MARKS, scoreAnswer, summarise } from "./scoring";

describe("scoreAnswer", () => {
  it("gives +4 for a correct answer", () => {
    expect(scoreAnswer("B", "B")).toEqual({ result: "correct", points: 4 });
  });

  it("gives -1 for a wrong answer", () => {
    expect(scoreAnswer("A", "C")).toEqual({ result: "wrong", points: -1 });
  });

  it("gives 0 for a skipped question", () => {
    expect(scoreAnswer(null, "D")).toEqual({ result: "skipped", points: 0 });
  });
});

describe("summarise", () => {
  it("returns zeros and null accuracy for an empty session", () => {
    expect(summarise([])).toEqual({ total: 0, correct: 0, wrong: 0, skipped: 0, accuracy: null });
  });

  it("adds up marks and excludes skips from accuracy", () => {
    const s = summarise(["correct", "correct", "wrong", "skipped"]);
    expect(s).toMatchObject({ total: 7, correct: 2, wrong: 1, skipped: 1 });
    expect(s.accuracy).toBeCloseTo(2 / 3);
  });

  it("allows a negative total", () => {
    expect(summarise(["wrong", "wrong", "skipped"]).total).toBe(-2);
  });

  it("returns null accuracy when everything was skipped", () => {
    expect(summarise(["skipped", "skipped"]).accuracy).toBeNull();
  });

  it("matches the NEET PG marking scheme", () => {
    expect(MARKS).toEqual({ correct: 4, wrong: -1, skipped: 0 });
  });
});
