import { describe, expect, it } from "vitest";

import { buildCalendar, levelFor } from "./heatmap";
import { accuracyBoard, mostImproved, rankByScore, shortName, standing, weekStart, type Row } from "./leaderboard";

const row = (userId: string, score: number, correct = 0, wrong = 0, answered = correct + wrong): Row => ({
  userId,
  name: userId,
  email: `${userId}@example.com`,
  score,
  correct,
  wrong,
  answered,
  streak: 0,
});

describe("shortName", () => {
  it("shows first name and last initial", () => {
    expect(shortName("Priya Sharma", null)).toBe("Priya S.");
    expect(shortName("  anil kumar reddy ", null)).toBe("anil R.");
    expect(shortName("Madonna", null)).toBe("Madonna");
  });

  it("falls back to the email's local part", () => {
    expect(shortName(null, "dr.rao@gmail.com")).toBe("dr.rao");
    expect(shortName(null, null)).toBe("Aspirant");
  });
});

describe("weekStart", () => {
  it("is Monday 00:00 IST", () => {
    // Wednesday 12 Nov 2026, 10:00 IST
    expect(weekStart(new Date("2026-11-12T04:30:00Z")).toISOString()).toBe("2026-11-08T18:30:00.000Z");
  });

  it("uses the IST date near midnight (Sunday 23:30 UTC is already Monday in IST)", () => {
    expect(weekStart(new Date("2026-11-15T19:00:00Z")).toISOString()).toBe("2026-11-15T18:30:00.000Z");
  });
});

describe("rankByScore", () => {
  it("orders by score and shares ranks on ties", () => {
    const r = rankByScore([row("a", 10, 3, 2), row("b", 20, 5), row("c", 10, 3, 2), row("d", 5, 2, 3)]);
    expect(r.map((x) => [x.userId, x.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 2],
      ["d", 4],
    ]);
  });

  it("puts fewer answers first when scores and correct counts tie, and drops people with no answers", () => {
    const r = rankByScore([row("many", 8, 3, 4, 9), row("few", 8, 3, 4, 7), row("none", 0, 0, 0, 0)]);
    expect(r.map((x) => x.userId)).toEqual(["few", "many"]);
  });

  it("handles negative scores", () => {
    expect(rankByScore([row("a", -3, 1, 7), row("b", 4, 1)]).map((x) => x.userId)).toEqual(["b", "a"]);
  });
});

describe("standing", () => {
  const ranked = rankByScore([row("a", 50, 13), row("b", 40, 10), row("me", 30, 8), row("c", 30, 8), row("d", 10, 3)]);

  it("gives rank, percentile and the gap to pass the next person", () => {
    const s = standing(ranked, "me")!;
    expect(s.rank).toBe(3);
    expect(s.of).toBe(5);
    expect(s.aheadOf).toBeCloseTo(1 / 4); // only d has fewer points
    expect(s.next?.row.userId).toBe("b");
    expect(s.next?.gap).toBe(11);
  });

  it("lists neighbours either side", () => {
    expect(standing(ranked, "me")!.neighbours.map((r) => r.userId)).toEqual(["b", "c", "me", "d"]); // tie with c broken by id
    expect(standing(ranked, "a", 1)!.neighbours.map((r) => r.userId)).toEqual(["a", "b"]);
  });

  it("has no one to pass at the top, and no percentile when alone", () => {
    expect(standing(ranked, "a")!.next).toBeNull();
    expect(standing(rankByScore([row("solo", 4, 1)]), "solo")!.aheadOf).toBeNull();
  });

  it("is null for someone not ranked", () => {
    expect(standing(ranked, "nobody")).toBeNull();
  });
});

describe("accuracyBoard", () => {
  it("needs a minimum number of answers and ranks by accuracy", () => {
    const board = accuracyBoard([row("small", 16, 4, 0), row("x", 0, 40, 10), row("y", 0, 45, 5)], 50);
    expect(board.map((r) => r.userId)).toEqual(["y", "x"]);
    expect(board[0].accuracy).toBeCloseTo(0.9);
  });
});

describe("mostImproved", () => {
  it("ranks accuracy gains this week over earlier weeks, ignoring small samples and declines", () => {
    const week = [row("up", 0, 18, 2), row("down", 0, 10, 10), row("new", 0, 20, 0), row("tiny", 0, 5, 0)];
    const before = new Map([
      ["up", { correct: 10, wrong: 10 }],
      ["down", { correct: 18, wrong: 2 }],
      ["tiny", { correct: 1, wrong: 30 }],
    ]);
    const out = mostImproved(week, before);
    expect(out.map((i) => i.row.userId)).toEqual(["up"]);
    expect(out[0].delta).toBeCloseTo(0.4);
  });
});

describe("heatmap", () => {
  it("maps counts to levels with fixed thresholds", () => {
    expect([0, 1, 9, 10, 24, 25, 49, 50, 300].map(levelFor)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it("builds Monday-first weeks ending in the current week", () => {
    // Thursday 12 Nov 2026
    const cal = buildCalendar(new Map([["2026-11-12", 12], ["2026-11-02", 3]]), "2026-11-12", 3);
    expect(cal.columns).toHaveLength(3);
    expect(cal.columns[0][0].day).toBe("2026-10-26"); // a Monday
    expect(cal.columns[2][3]).toMatchObject({ day: "2026-11-12", count: 12, level: 2, future: false });
    expect(cal.columns[2][4].future).toBe(true);
    expect(cal.total).toBe(15);
    expect(cal.activeDays).toBe(2);
    expect(cal.months.map((m) => m.label)).toEqual(["Oct", "Nov"]);
  });
});
