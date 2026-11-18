import { describe, expect, it } from "vitest";

import { isAdminEmail, NOTE_MAX, parseAdminEmails, reportSchema } from "./reports";

describe("reportSchema", () => {
  it("accepts a reason without a note and stores the note as null", () => {
    expect(reportSchema.parse({ questionId: 7, reason: "typo" })).toEqual({ questionId: 7, reason: "typo", note: null });
    expect(reportSchema.parse({ questionId: 7, reason: "typo", note: "   " }).note).toBeNull();
  });

  it("trims the note", () => {
    expect(reportSchema.parse({ questionId: 7, reason: "wrong_answer", note: "  B is correct  " }).note).toBe("B is correct");
  });

  it("requires a note for 'other'", () => {
    expect(reportSchema.safeParse({ questionId: 7, reason: "other" }).success).toBe(false);
    expect(reportSchema.safeParse({ questionId: 7, reason: "other", note: "Image missing" }).success).toBe(true);
  });

  it("rejects unknown reasons, bad ids and long notes", () => {
    expect(reportSchema.safeParse({ questionId: 7, reason: "spam" }).success).toBe(false);
    expect(reportSchema.safeParse({ questionId: 0, reason: "typo" }).success).toBe(false);
    expect(reportSchema.safeParse({ questionId: 7, reason: "typo", note: "x".repeat(NOTE_MAX + 1) }).success).toBe(false);
    expect(reportSchema.safeParse({ questionId: 7, reason: "typo", note: "x".repeat(NOTE_MAX) }).success).toBe(true);
  });
});

describe("admin emails", () => {
  it("parses a comma-separated list, ignoring case, spaces and junk", () => {
    expect([...parseAdminEmails(" A@x.com, b@Y.org ,,nope ")]).toEqual(["a@x.com", "b@y.org"]);
  });

  it("locks everyone out when the variable is missing or empty", () => {
    expect(isAdminEmail("a@x.com", undefined)).toBe(false);
    expect(isAdminEmail("a@x.com", "")).toBe(false);
  });

  it("matches case-insensitively and never matches a missing email", () => {
    expect(isAdminEmail("A@X.com", "a@x.com")).toBe(true);
    expect(isAdminEmail("c@x.com", "a@x.com")).toBe(false);
    expect(isAdminEmail(null, "a@x.com")).toBe(false);
  });
});
