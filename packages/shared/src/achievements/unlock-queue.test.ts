import { describe, expect, it } from "vitest";

import type { PersistedUnlock } from "./types";
import { batchEarnsConfetti, mergeUnlocks } from "./unlock-queue";

function unlock(eventId: string, tier: 1 | 2 | 3 | 4): PersistedUnlock {
  return {
    eventId,
    slug: `drinks_total.t${tier}`,
    seriesId: "drinks_total",
    tier,
    category: "drinking",
    scope: "festival",
    glyph: "masskrug",
    points: 10,
  };
}

describe("mergeUnlocks", () => {
  it("appends unlocks the queue has not seen", () => {
    const merged = mergeUnlocks([unlock("a", 1)], [unlock("b", 2)]);

    expect(merged.map((entry) => entry.eventId)).toEqual(["a", "b"]);
  });

  it("drops an incoming unlock whose eventId is already queued", () => {
    const merged = mergeUnlocks([unlock("a", 1)], [unlock("a", 1), unlock("b", 2)]);

    expect(merged.map((entry) => entry.eventId)).toEqual(["a", "b"]);
  });

  it("dedups within the incoming batch itself", () => {
    const merged = mergeUnlocks([], [unlock("a", 1), unlock("a", 1)]);

    expect(merged).toHaveLength(1);
  });

  it("returns the same array reference when nothing new arrives", () => {
    const queue = [unlock("a", 1)];

    expect(mergeUnlocks(queue, [unlock("a", 1)])).toBe(queue);
  });
});

describe("batchEarnsConfetti", () => {
  it("is false for an empty batch", () => {
    expect(batchEarnsConfetti([])).toBe(false);
  });

  it("is false when the highest tier is silver", () => {
    expect(batchEarnsConfetti([unlock("a", 1), unlock("b", 2)])).toBe(false);
  });

  it("is true when the batch contains gold", () => {
    expect(batchEarnsConfetti([unlock("a", 1), unlock("b", 3)])).toBe(true);
  });

  it("is true when the batch contains platinum", () => {
    expect(batchEarnsConfetti([unlock("a", 4)])).toBe(true);
  });
});
