import { describe, expect, it } from "vitest";

import { AI_LIMITS, buildPrompt, checkLimits, globalDailyCap, parseExplanation, type ExplainInput } from "./ai-explain";

const input: ExplainInput = {
  question: "Drug of choice for absence seizures?",
  options: { A: "Phenytoin", B: "Ethosuximide", C: "Carbamazepine", D: "Phenobarbitone" },
  correctOption: "B",
  chosenOption: "A",
  explanation: "Ethosuximide blocks T-type calcium channels.",
};

describe("buildPrompt", () => {
  it("includes the question, all options, the key, the student's pick and the reference", () => {
    const p = buildPrompt(input);
    expect(p).toContain("Drug of choice for absence seizures?");
    expect(p).toContain("D. Phenobarbitone");
    expect(p).toContain("Answer key: B. Ethosuximide");
    expect(p).toContain("Student chose: A. Phenytoin");
    expect(p).toContain("T-type calcium channels");
  });

  it("says when there is no reference explanation", () => {
    expect(buildPrompt({ ...input, explanation: null })).toContain("(none provided)");
  });

  it("refuses when the chosen option is the correct one", () => {
    expect(() => buildPrompt({ ...input, chosenOption: "B" })).toThrow();
  });
});

describe("parseExplanation", () => {
  const good = { whyWrong: "Phenytoin can worsen absence seizures.", whyRight: "Ethosuximide blocks T-type channels.", remember: "Absence: ethosuximide." };

  it("accepts a valid answer and trims it", () => {
    expect(parseExplanation(JSON.stringify({ ...good, remember: "  Absence: ethosuximide.  " }))).toEqual(good);
  });

  it("rejects malformed, incomplete or oversized answers", () => {
    expect(parseExplanation(undefined)).toBeNull();
    expect(parseExplanation("not json")).toBeNull();
    expect(parseExplanation(JSON.stringify({ whyWrong: good.whyWrong }))).toBeNull();
    expect(parseExplanation(JSON.stringify({ ...good, whyRight: "x".repeat(701) }))).toBeNull();
  });
});

describe("checkLimits", () => {
  const fresh = { userCalls: 0, userRequests: 0, globalCalls: 0 };

  it("allows a fresh user", () => {
    expect(checkLimits(fresh, 400, true)).toEqual({ ok: true });
  });

  it("caps model calls per user and globally, but not cached answers", () => {
    const busy = { ...fresh, userCalls: AI_LIMITS.userCallsPerDay };
    expect(checkLimits(busy, 400, true)).toEqual({ ok: false, reason: "user-calls" });
    expect(checkLimits(busy, 400, false)).toEqual({ ok: true });
    expect(checkLimits({ ...fresh, globalCalls: 400 }, 400, true)).toEqual({ ok: false, reason: "global" });
  });

  it("caps all requests, cached included", () => {
    expect(checkLimits({ ...fresh, userRequests: AI_LIMITS.userRequestsPerDay }, 400, false)).toEqual({ ok: false, reason: "user-requests" });
  });
});

describe("globalDailyCap", () => {
  it("reads AI_DAILY_CAP and falls back to the default", () => {
    expect(globalDailyCap("50")).toBe(50);
    expect(globalDailyCap("0")).toBe(0);
    expect(globalDailyCap(undefined)).toBe(AI_LIMITS.globalCallsPerDay);
    expect(globalDailyCap("lots")).toBe(AI_LIMITS.globalCallsPerDay);
  });
});
