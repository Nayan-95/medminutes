import { describe, expect, it } from "vitest";

import { seededRng } from "./random";
import {
  closestToTarget,
  interleave,
  pickCoverageUnits,
  pickWeakUnits,
  planSlots,
  predictSuccess,
  sampleBeta,
  shrink,
  SMART_MIX,
  unitBeliefs,
  unitKey,
  type Pick,
  type UnitStats,
} from "./recommend";

const unit = (subjectId: number, topicId: number | null, seen: number, correct: number, total = 100): UnitStats => ({
  key: unitKey(subjectId, topicId),
  subjectId,
  topicId,
  total,
  seen,
  correct,
});

describe("shrink", () => {
  it("returns the prior with no answers and moves toward the data as answers grow", () => {
    expect(shrink(0, 0, 0.6)).toBeCloseTo(0.6);
    const few = shrink(1, 2, 0.6); // 50% from 2 answers
    const many = shrink(50, 100, 0.6); // 50% from 100 answers
    expect(few).toBeGreaterThan(many);
    expect(many).toBeCloseTo(0.5, 1);
  });
});

describe("unitBeliefs", () => {
  it("doesn't call a topic weak from one unlucky answer", () => {
    const [oneWrong, consistentlyWrong] = unitBeliefs([unit(1, 1, 1, 0), unit(1, 2, 20, 6), unit(1, 3, 40, 32)]);
    expect(oneWrong.mean).toBeGreaterThan(consistentlyWrong.mean);
    expect(oneWrong.mean).toBeGreaterThan(0.5);
    expect(consistentlyWrong.mean).toBeLessThan(0.5);
  });

  it("starts an unseen topic at its subject's level", () => {
    const beliefs = unitBeliefs([unit(1, 1, 30, 27), unit(1, 2, 0, 0), unit(2, 3, 30, 9), unit(2, 4, 0, 0)]);
    const strongSubjectNew = beliefs.find((b) => b.key === unitKey(1, 2))!;
    const weakSubjectNew = beliefs.find((b) => b.key === unitKey(2, 4))!;
    expect(strongSubjectNew.mean).toBeGreaterThan(weakSubjectNew.mean);
  });
});

describe("planSlots", () => {
  it("always adds up to the session size", () => {
    for (const count of [1, 5, 10, 20, 50]) {
      for (const due of [0, 3, 100]) {
        const p = planSlots(count, { inScope: due, total: due });
        expect(p.review + p.weak + p.coverage + p.random).toBe(count);
        expect(Object.values(p).every((n) => n >= 0)).toBe(true);
      }
    }
  });

  it("gives 30% to reviews normally and 50% when the backlog is large", () => {
    expect(planSlots(20, { inScope: 50, total: 10 }).review).toBe(6);
    expect(planSlots(20, { inScope: 50, total: SMART_MIX.backlogThreshold }).review).toBe(10);
  });

  it("never plans more reviews than are due", () => {
    expect(planSlots(20, { inScope: 2, total: 2 }).review).toBe(2);
  });

  it("keeps a random slot in every normal-sized session", () => {
    expect(planSlots(10, { inScope: 0, total: 0 }).random).toBeGreaterThanOrEqual(1);
  });
});

describe("sampleBeta", () => {
  it("has the right mean", () => {
    const rng = seededRng(1);
    let sum = 0;
    for (let i = 0; i < 5000; i++) sum += sampleBeta(3, 7, rng);
    expect(sum / 5000).toBeCloseTo(0.3, 1);
  });

  it("works for shape parameters below 1", () => {
    const x = sampleBeta(0.5, 0.5, seededRng(2));
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(1);
  });
});

describe("pickWeakUnits", () => {
  const beliefs = unitBeliefs([unit(1, 1, 20, 4), unit(1, 2, 20, 18), unit(1, 3, 0, 0)]);

  it("mostly picks the weakest practised topic", () => {
    const rng = seededRng(3);
    let weak = 0;
    let strong = 0;
    for (let i = 0; i < 200; i++) {
      const picks = pickWeakUnits(beliefs, 1, rng);
      weak += picks.get(unitKey(1, 1)) ?? 0;
      strong += picks.get(unitKey(1, 2)) ?? 0;
    }
    expect(weak).toBeGreaterThan(strong * 3);
  });

  it("never picks unseen topics (that's coverage's job)", () => {
    const picks = pickWeakUnits(beliefs, 10, seededRng(4));
    expect(picks.has(unitKey(1, 3))).toBe(false);
    expect([...picks.values()].reduce((a, b) => a + b, 0)).toBe(10);
  });

  it("spreads picks across weak topics instead of hammering one", () => {
    const several = unitBeliefs([unit(1, 1, 20, 6), unit(1, 2, 20, 7), unit(1, 3, 20, 6)]);
    const picks = pickWeakUnits(several, 6, seededRng(5));
    expect(picks.size).toBeGreaterThan(1);
  });

  it("doesn't pick more questions than a topic has left", () => {
    const tiny = unitBeliefs([unit(1, 1, 2, 0, 3)]);
    expect(pickWeakUnits(tiny, 5, seededRng(6)).get(unitKey(1, 1))).toBe(1);
  });
});

describe("pickCoverageUnits", () => {
  it("prefers unseen topics and picks the requested number", () => {
    const units = [unit(1, 1, 50, 30), unit(1, 2, 0, 0), unit(1, 3, 0, 0), unit(1, 4, 0, 0)];
    const picks = pickCoverageUnits(units, 3, seededRng(7));
    expect([...picks.values()].reduce((a, b) => a + b, 0)).toBe(3);
    expect(picks.has(unitKey(1, 1))).toBe(false);
  });

  it("wraps around when there are fewer topics than picks", () => {
    const picks = pickCoverageUnits([unit(1, 1, 0, 0, 10)], 3, seededRng(8));
    expect(picks.get(unitKey(1, 1))).toBe(3);
  });

  it("skips exhausted topics, counting questions already taken", () => {
    const picks = pickCoverageUnits([unit(1, 1, 0, 0, 1)], 1, seededRng(9), new Map([[unitKey(1, 1), 1]]));
    expect(picks.size).toBe(0);
  });
});

describe("predictSuccess / closestToTarget", () => {
  it("uses the topic estimate when the question has no data", () => {
    expect(predictSuccess(0.7)).toBe(0.7);
  });

  it("lowers the prediction for questions most people get wrong", () => {
    expect(predictSuccess(0.7, { correct: 2, answered: 40 })).toBeLessThan(0.7);
    expect(predictSuccess(0.7, { correct: 38, answered: 40 })).toBeGreaterThan(0.7);
  });

  it("picks the candidates nearest the 75% target", () => {
    const cands = [0.3, 0.74, 0.95, 0.8, 0.5].map((p, i) => ({ id: i, p }));
    expect(closestToTarget(cands, 2).map((c) => c.p)).toEqual([0.74, 0.8]);
  });
});

describe("interleave", () => {
  const pick = (questionId: number, unitKey: string, p: number, slot: Pick["slot"] = "weak"): Pick => ({ questionId, unitKey, p, slot });

  it("keeps every question exactly once", () => {
    const picks = Array.from({ length: 12 }, (_, i) => pick(i, `u${i % 3}`, 0.4 + (i % 5) * 0.1));
    const out = interleave(picks, seededRng(10));
    expect(out.map((p) => p.questionId).sort((a, b) => a - b)).toEqual(picks.map((p) => p.questionId));
  });

  it("avoids the same topic twice in a row when it can", () => {
    const picks = [pick(1, "a", 0.8), pick(2, "a", 0.8), pick(3, "b", 0.8), pick(4, "b", 0.8), pick(5, "c", 0.8)];
    const out = interleave(picks, seededRng(11));
    for (let i = 1; i < out.length; i++) expect(out[i].unitKey).not.toBe(out[i - 1].unitKey);
  });

  it("never serves more than 2 likely-wrong questions in a row when easier ones remain", () => {
    const hard = Array.from({ length: 6 }, (_, i) => pick(i, `h${i}`, 0.3));
    const easy = Array.from({ length: 4 }, (_, i) => pick(10 + i, `e${i}`, 0.9));
    const out = interleave([...hard, ...easy], seededRng(12));
    let run = 0;
    let maxRun = 0;
    for (const p of out.slice(0, 8)) {
      run = p.p < SMART_MIX.hardBelow ? run + 1 : 0;
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeLessThanOrEqual(SMART_MIX.maxHardInARow);
  });
});
