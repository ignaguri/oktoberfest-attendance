import { describe, expect, it } from "vitest";

import { isNearBottom } from "../is-near-bottom";

const metrics = (offsetY: number, contentHeight = 3000, viewportHeight = 800) => ({
  contentOffset: { y: offsetY },
  contentSize: { height: contentHeight },
  layoutMeasurement: { height: viewportHeight },
});

describe("isNearBottom", () => {
  it("is false at the top of a long page", () => {
    expect(isNearBottom(metrics(0))).toBe(false);
  });

  it("turns true once the end is within the threshold", () => {
    // 3000 - (1600 + 800) = 600 left
    expect(isNearBottom(metrics(1599))).toBe(false);
    expect(isNearBottom(metrics(1600))).toBe(true);
  });

  it("is true at the very end and past it (rubber-band overscroll)", () => {
    expect(isNearBottom(metrics(2200))).toBe(true);
    expect(isNearBottom(metrics(2300))).toBe(true);
  });

  it("is true when the content is shorter than the viewport", () => {
    expect(isNearBottom(metrics(0, 500))).toBe(true);
  });

  it("honours a custom threshold", () => {
    expect(isNearBottom(metrics(2100), 50)).toBe(false);
    expect(isNearBottom(metrics(2150), 50)).toBe(true);
  });
});
