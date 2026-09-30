import { describe, expect, it } from "vitest";

import { barFraction } from "../bar-fraction";

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
