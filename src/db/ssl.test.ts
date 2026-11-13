import { describe, expect, it } from "vitest";

import { withVerifiedSsl } from "./ssl";

describe("withVerifiedSsl", () => {
  it("upgrades sslmode=require to verify-full and keeps other params", () => {
    const out = new URL(
      withVerifiedSsl("postgresql://u:p%40ss@host-pooler.neon.tech/db?sslmode=require&channel_binding=require"),
    );
    expect(out.searchParams.get("sslmode")).toBe("verify-full");
    expect(out.searchParams.get("channel_binding")).toBe("require");
    expect(decodeURIComponent(out.password)).toBe("p@ss");
    expect(out.hostname).toBe("host-pooler.neon.tech");
  });

  it("adds verify-full when sslmode is missing", () => {
    expect(new URL(withVerifiedSsl("postgresql://u:p@h/db")).searchParams.get("sslmode")).toBe("verify-full");
  });

  it("leaves an explicit disable or verify-full alone", () => {
    expect(withVerifiedSsl("postgresql://u:p@h/db?sslmode=disable")).toContain("sslmode=disable");
    expect(withVerifiedSsl("postgresql://u:p@h/db?sslmode=verify-full")).toContain("sslmode=verify-full");
  });

  it("passes an empty string through (build without env)", () => {
    expect(withVerifiedSsl("")).toBe("");
  });
});
