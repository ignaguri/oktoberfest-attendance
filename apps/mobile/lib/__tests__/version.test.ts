import { describe, expect, it } from "vitest";

import { isNewerVersion } from "../version";

describe("isNewerVersion", () => {
  it("is false when the versions match", () => {
    expect(isNewerVersion("1.6.2", "1.6.2")).toBe(false);
  });

  it("detects a newer patch, minor, and major", () => {
    expect(isNewerVersion("1.6.2", "1.6.3")).toBe(true);
    expect(isNewerVersion("1.6.2", "1.7.0")).toBe(true);
    expect(isNewerVersion("1.6.2", "2.0.0")).toBe(true);
  });

  it("is false when the other version is older", () => {
    expect(isNewerVersion("1.7.0", "1.6.2")).toBe(false);
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(false);
  });

  // Segments are numbers, not text: a string comparison puts "1.10.0" before
  // "1.9.0" and would tell a user on the newest build to go update.
  it("compares segments numerically, not lexically", () => {
    expect(isNewerVersion("1.9.0", "1.10.0")).toBe(true);
    expect(isNewerVersion("1.10.0", "1.9.0")).toBe(false);
  });

  it("treats missing trailing segments as zero", () => {
    expect(isNewerVersion("1.6", "1.6.2")).toBe(true);
    expect(isNewerVersion("1.6.2", "1.6")).toBe(false);
    expect(isNewerVersion("1.6.0", "1.6")).toBe(false);
  });

  // The store and the endpoint are both remote inputs. Anything unparseable
  // must not be read as "newer", or a bad payload nags every user at once.
  it("is false for unparseable input", () => {
    expect(isNewerVersion("1.6.2", "not-a-version")).toBe(false);
    expect(isNewerVersion("not-a-version", "1.6.2")).toBe(false);
    expect(isNewerVersion("1.6.2", "")).toBe(false);
  });
});
