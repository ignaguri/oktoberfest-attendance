import { describe, expect, it } from "vitest";

import { countUpValue } from "./count-up";

describe("countUpValue", () => {
  it("starts at 0, ends at the target and eases out", () => {
    expect(countUpValue(100, 0, 900)).toBe(0);
    expect(countUpValue(100, 900, 900)).toBe(100);
    expect(countUpValue(100, 2000, 900)).toBe(100);
    expect(countUpValue(100, 450, 900)).toBeGreaterThan(50);
  });
});
