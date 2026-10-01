import { describe, expect, it } from "vitest";

import { averagePerDay } from "../profile.repository";

describe("averagePerDay", () => {
  it("rounds half up to 2 decimals like PostgreSQL ROUND", () => {
    // Dividing first lands just below the half: 11.5 / 20 * 100 = 57.49999...
    expect(averagePerDay(11.5, 20)).toBe(0.58);
    expect(averagePerDay(23, 40)).toBe(0.58);
  });

  it("returns 0 with no days", () => {
    expect(averagePerDay(5, 0)).toBe(0);
  });
});
