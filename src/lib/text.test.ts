import { describe, expect, it } from "vitest";

import { cleanOptional, cleanText } from "./text";

describe("cleanText", () => {
  it("strips paragraph, image and link tags from source text", () => {
    expect(cleanText('<p>Radial nerve.</p><p>See <a href="x">this</a> <img src="y.png"></p>')).toBe(
      "Radial nerve.\nSee this",
    );
  });

  it("keeps clinical comparisons that look like tags", () => {
    expect(cleanText("Give if age <5 years and K+ <3.5 mEq/L; ratio 3>1")).toBe(
      "Give if age <5 years and K+ <3.5 mEq/L; ratio 3>1",
    );
    expect(cleanText("x <rest of sentence")).toBe("x <rest of sentence");
  });

  it("decodes common entities", () => {
    expect(cleanText("A &amp; B &lt; C&nbsp;D")).toBe("A & B < C D");
  });

  it("returns null for explanations that were only markup", () => {
    expect(cleanOptional("<p></p>")).toBeNull();
    expect(cleanOptional(null)).toBeNull();
  });
});
