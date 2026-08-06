import { describe, expect, it } from "vitest";

import { CATEGORY_COLORS, getCategoryColor, TIER_RING_WIDTH } from "./badge-tokens";
import type { AchievementCategory, AchievementTier } from "./types";

const CATEGORIES: AchievementCategory[] = [
  "drinking",
  "attendance",
  "explorer",
  "social",
  "competitive",
  "dedication",
];

const TIERS: AchievementTier[] = [1, 2, 3, 4];

describe("badge tokens", () => {
  it("has a color for every current category", () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_COLORS[category]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("getCategoryColor returns the mapped color for current categories", () => {
    expect(getCategoryColor("drinking")).toBe(CATEGORY_COLORS.drinking);
  });

  it("getCategoryColor falls back to gray for unrecognized/legacy categories", () => {
    expect(getCategoryColor("consumption")).toBe("#9CA3AF");
    expect(getCategoryColor("special")).toBe("#9CA3AF");
    expect(getCategoryColor("not-a-real-category")).toBe("#9CA3AF");
  });

  it("has a ring width for every tier, strictly increasing", () => {
    let previous = 0;
    for (const tier of TIERS) {
      expect(TIER_RING_WIDTH[tier]).toBeGreaterThan(previous);
      previous = TIER_RING_WIDTH[tier];
    }
  });
});
