import { Rating, State } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { describeNextReview, fromRow, gradeFor, replay, schedule, toRow } from "./srs";

const T0 = new Date("2026-11-13T10:00:00Z");
const days = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 86_400_000;

describe("gradeFor", () => {
  it("maps correct to Good and wrong/skipped to Again", () => {
    expect(gradeFor("correct")).toBe(Rating.Good);
    expect(gradeFor("wrong")).toBe(Rating.Again);
    expect(gradeFor("skipped")).toBe(Rating.Again);
  });
});

describe("schedule", () => {
  it("brings a wrong answer back about a day later", () => {
    const c = schedule(null, "wrong", T0);
    expect(days(T0, c.due)).toBeGreaterThanOrEqual(1);
    expect(days(T0, c.due)).toBeLessThanOrEqual(2);
  });

  it("spaces correct answers further apart each time", () => {
    let card = schedule(null, "correct", T0);
    const gaps = [days(T0, card.due)];
    for (let i = 0; i < 3; i++) {
      const now = card.due;
      card = schedule(card, "correct", now);
      gaps.push(days(now, card.due));
    }
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThan(gaps[i - 1]);
    expect(card.state).toBe(State.Review);
  });

  it("shrinks the interval and counts a lapse when a known card is forgotten", () => {
    let card = schedule(null, "correct", T0);
    card = schedule(card, "correct", card.due);
    const before = card.scheduled_days;
    card = schedule(card, "wrong", card.due);
    expect(card.lapses).toBe(1);
    expect(card.scheduled_days).toBeLessThan(before);
  });

  it("never schedules beyond a year", () => {
    let card = schedule(null, "correct", T0);
    for (let i = 0; i < 12; i++) card = schedule(card, "correct", card.due);
    expect(card.scheduled_days).toBeLessThanOrEqual(366);
  });
});

describe("replay", () => {
  it("rebuilds the same card as answering step by step", () => {
    const history = [
      { result: "wrong" as const, at: T0 },
      { result: "correct" as const, at: new Date("2026-11-14T10:00:00Z") },
      { result: "correct" as const, at: new Date("2026-11-18T09:00:00Z") },
    ];
    let step = schedule(null, history[0].result, history[0].at);
    step = schedule(step, history[1].result, history[1].at);
    step = schedule(step, history[2].result, history[2].at);
    expect(replay(history)).toEqual(step);
    expect(replay([])).toBeNull();
  });
});

describe("row mapping", () => {
  it("round-trips a card through the database shape", () => {
    const card = schedule(schedule(null, "correct", T0), "wrong", new Date("2026-11-16T10:00:00Z"));
    expect(fromRow(toRow(card))).toEqual(card);
  });
});

describe("describeNextReview", () => {
  it("reads naturally", () => {
    expect(describeNextReview(new Date("2026-11-14T10:00:00Z"), T0)).toBe("tomorrow");
    expect(describeNextReview(new Date("2026-11-27T10:00:00Z"), T0)).toBe("in 14 days");
    expect(describeNextReview(new Date("2027-03-13T10:00:00Z"), T0)).toBe("in 4 months");
  });
});
