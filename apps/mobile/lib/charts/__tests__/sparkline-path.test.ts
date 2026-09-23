import { describe, expect, it } from "vitest";

import { barFraction, sparklinePath } from "../sparkline-path";

describe("sparklinePath", () => {
  it("is empty without values", () => {
    expect(sparklinePath([], 100, 20)).toBe("");
  });

  it("draws a single value as a flat line across the middle", () => {
    expect(sparklinePath([5], 100, 20)).toBe("M0 10 L100 10");
  });

  it("draws a flat series across the middle", () => {
    expect(sparklinePath([3, 3, 3], 100, 20)).toBe("M0 10 L50 10 L100 10");
  });

  it("puts the minimum at the bottom and the maximum at the top", () => {
    expect(sparklinePath([0, 5, 10], 100, 20)).toBe("M0 20 L50 10 L100 0");
  });

  it("rounds coordinates to two decimals", () => {
    expect(sparklinePath([0, 1, 0, 1], 100, 20)).toBe("M0 20 L33.33 0 L66.67 20 L100 0");
  });
});

describe("barFraction", () => {
  it("scales against the max", () => {
    expect(barFraction(5, 10)).toBe(0.5);
  });

  it("is zero when there is nothing to scale against", () => {
    expect(barFraction(0, 0)).toBe(0);
    expect(barFraction(3, 0)).toBe(0);
  });

  it("clamps into 0..1", () => {
    expect(barFraction(15, 10)).toBe(1);
    expect(barFraction(-1, 10)).toBe(0);
  });
});
