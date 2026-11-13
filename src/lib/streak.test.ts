import { describe, expect, it } from "vitest";

import { computeStreak, dayKey } from "./streak";

describe("computeStreak", () => {
  it("is zero with no practice", () => {
    expect(computeStreak([], "2026-11-13")).toEqual({ current: 0, best: 0, practisedToday: false });
  });

  it("counts a run ending today", () => {
    expect(computeStreak(["2026-11-11", "2026-11-12", "2026-11-13"], "2026-11-13")).toMatchObject({
      current: 3,
      practisedToday: true,
    });
  });

  it("keeps yesterday's run alive until today ends", () => {
    expect(computeStreak(["2026-11-11", "2026-11-12"], "2026-11-13")).toMatchObject({
      current: 2,
      practisedToday: false,
    });
  });

  it("resets after a missed day but remembers the best run", () => {
    const s = computeStreak(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-12"], "2026-11-14");
    expect(s).toEqual({ current: 0, best: 4, practisedToday: false });
  });

  it("handles month and year boundaries and duplicates", () => {
    expect(computeStreak(["2026-12-31", "2027-01-01", "2027-01-01"], "2027-01-01").current).toBe(2);
    expect(computeStreak(["2026-02-28", "2026-03-01"], "2026-03-01").current).toBe(2);
  });
});

describe("dayKey", () => {
  it("uses India time, so 1 AM IST is the new day", () => {
    // 2026-11-12T19:45Z is 2026-11-13 01:15 IST.
    expect(dayKey(new Date("2026-11-12T19:45:00Z"))).toBe("2026-11-13");
    expect(dayKey(new Date("2026-11-12T18:00:00Z"))).toBe("2026-11-12");
  });
});
