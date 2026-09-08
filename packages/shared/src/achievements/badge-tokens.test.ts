import { describe, expect, it } from "vitest";

import { CATEGORY_COLORS, getCategoryColor, glyphSizePx, TIER_RING_WIDTH } from "./badge-tokens";
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

  // The four badge diameters are declared per app (SIZE_PX in each
  // AchievementBadge), so this pins the ladder they have to produce rather
  // than importing it. scripts/glyphs/preview.sh renders approval previews at
  // these exact sizes, and the pipeline README quotes them as the sizes glyph
  // art has to survive.
  it("glyphSizePx yields the documented 22/27/38/65 ladder", () => {
    expect(glyphSizePx(32)).toBe(22);
    expect(glyphSizePx(40)).toBe(27);
    expect(glyphSizePx(56)).toBe(38);
    expect(glyphSizePx(96)).toBe(65);
  });

  it("glyphSizePx always returns whole pixels", () => {
    for (let diameter = 1; diameter <= 200; diameter += 1) {
      expect(Number.isInteger(glyphSizePx(diameter))).toBe(true);
    }
  });

  it("has a ring width for every tier, strictly increasing", () => {
    let previous = 0;
    for (const tier of TIERS) {
      expect(TIER_RING_WIDTH[tier]).toBeGreaterThan(previous);
      previous = TIER_RING_WIDTH[tier];
    }
  });
});
