import { describe, expect, it } from "vitest";

import { buildDoubtPrompt, cleanAnswer, clip, DOUBT_LIMITS, doubtRequestSchema, type DoubtContext } from "./ai-doubt";

const ctx: DoubtContext = {
  question: "Drug of choice for absence seizures?",
  options: { A: "Phenytoin", B: "Ethosuximide", C: "Carbamazepine", D: "Phenobarbitone" },
  correctOption: "B",
  explanation: "Ethosuximide blocks T-type calcium channels.",
};

describe("doubtRequestSchema", () => {
  it("accepts a chip or a typed doubt, not both or neither", () => {
    expect(doubtRequestSchema.safeParse({ questionId: 1, chip: "simple" }).success).toBe(true);
    expect(doubtRequestSchema.safeParse({ questionId: 1, text: "Why not valproate?" }).success).toBe(true);
    expect(doubtRequestSchema.safeParse({ questionId: 1, chip: "simple", text: "hi there" }).success).toBe(false);
    expect(doubtRequestSchema.safeParse({ questionId: 1 }).success).toBe(false);
    expect(doubtRequestSchema.safeParse({ questionId: 1, text: "  a " }).success).toBe(false);
  });

  it("rejects unknown chips, long doubts and long histories", () => {
    expect(doubtRequestSchema.safeParse({ questionId: 1, chip: "essay" }).success).toBe(false);
    expect(doubtRequestSchema.safeParse({ questionId: 1, text: "x".repeat(DOUBT_LIMITS.doubtChars + 1) }).success).toBe(false);
    const turn = { q: "why?", a: "because." };
    expect(doubtRequestSchema.safeParse({ questionId: 1, text: "and?", history: Array(DOUBT_LIMITS.perQuestion + 1).fill(turn) }).success).toBe(false);
  });
});

describe("buildDoubtPrompt", () => {
  it("is compact: question, options, key, reference and the doubt", () => {
    const p = buildDoubtPrompt(ctx, "Why not valproate?");
    expect(p).toBe(
      "Q: Drug of choice for absence seizures?\nA. Phenytoin\nB. Ethosuximide\nC. Carbamazepine\nD. Phenobarbitone\nKey: B\nReference: Ethosuximide blocks T-type calcium channels.\nDoubt: Why not valproate?",
    );
  });

  it("sends only the last earlier exchange", () => {
    const p = buildDoubtPrompt(ctx, "Third?", [
      { q: "First?", a: "One." },
      { q: "Second?", a: "Two." },
    ]);
    expect(p).not.toContain("First?");
    expect(p).toContain("Earlier doubt: Second?\nYour answer: Two.");
  });

  it("trims long explanations", () => {
    const p = buildDoubtPrompt({ ...ctx, explanation: "word ".repeat(1000) }, "ok?");
    const ref = p.split("\n").find((l) => l.startsWith("Reference: "))!;
    expect(ref.length).toBeLessThanOrEqual("Reference: ".length + DOUBT_LIMITS.explanationChars);
    expect(ref.endsWith("…")).toBe(true);
  });
});

describe("clip and cleanAnswer", () => {
  it("leaves short text alone and cuts long text at a word", () => {
    expect(clip("short", 10)).toBe("short");
    expect(clip("one two three four", 10)).toBe("one two…");
  });

  it("strips markdown and rejects empty replies", () => {
    expect(cleanAnswer("**Ethosuximide** blocks `T-type` channels.")).toBe("Ethosuximide blocks T-type channels.");
    expect(cleanAnswer("## Heading\nText")).toBe("Heading\nText");
    expect(cleanAnswer("   ")).toBeNull();
    expect(cleanAnswer(undefined)).toBeNull();
  });
});
