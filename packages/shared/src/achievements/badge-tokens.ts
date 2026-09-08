import type { AchievementCategory, AchievementTier } from "./types";

/**
 * Ring color per category, shown behind/around the achievement's glyph.
 * Same plain-hex-map pattern as RARITY_COLORS in wrapped/config.ts.
 */
export const CATEGORY_COLORS: Record<AchievementCategory, string> = {
  drinking: "#F97316",
  attendance: "#10B981",
  explorer: "#8B5CF6",
  social: "#EC4899",
  competitive: "#EF4444",
  dedication: "#6366F1",
};

const FALLBACK_CATEGORY_COLOR = "#9CA3AF";

/**
 * Safe accessor for CATEGORY_COLORS. `AchievementWithProgress.category` is
 * typed against the schema's 8-value enum (6 current categories plus
 * legacy `consumption`/`special`, kept for old rows — see Plan 3a's
 * design doc). This returns a neutral gray for anything not in the
 * 6-entry map instead of a type error or crash.
 */
export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category as AchievementCategory] ?? FALLBACK_CATEGORY_COLOR;
}

/**
 * Outline of a pip standing for a rung that has not been earned. Earned pips
 * take the category colour instead, so this is the only pip colour that is
 * not already derivable from CATEGORY_COLORS.
 */
export const LOCKED_PIP_COLOR = "#D1D5DB";

/**
 * Ring stroke width in px per tier (1=bronze .. 4=platinum). The only
 * portable part of tier styling — glow is implemented natively per
 * platform (see AchievementBadge components), not shared as data.
 */
export const TIER_RING_WIDTH: Record<AchievementTier, number> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
};

/**
 * Glyph diameter as a fraction of the badge's, so the art clears the ring.
 * The art is exported trimmed to its own bounding box with a small margin, so
 * it needs the extra room over the 0.6 the first bitmap set used — at 0.6 it
 * read as a dot inside the ring.
 *
 * Shared because it decides what the art has to survive, not just how the
 * badge looks: against the badge sizes it yields a render ladder of roughly
 * 22 / 27 / 38 / 65 px, the 22 governs every glyph design decision, and
 * scripts/glyphs/ sizes its previews and its 256px export from the same
 * number. Changing it in one app only would leave the other app and the art
 * pipeline disagreeing about what "legible" has to mean.
 */
export const GLYPH_SIZE_RATIO = 0.68;

/**
 * Glyph size a badge of `badgeDiameterPx` draws, in whole pixels.
 *
 * The ratio alone yields 21.76 / 27.2 / 38.08 / 65.28 for the four badge
 * diameters, and every consumer wants the integers those round to. `next/image`
 * takes width and height as pixel counts, and `scripts/glyphs/preview.sh`
 * renders the previews a glyph is approved from at exactly 22 / 27 / 38 / 65,
 * so an unrounded size ships art at a size nobody reviewed it at.
 *
 * Shared rather than rounded per app for the same reason the ratio is: the
 * ladder is a contract between both apps and the art pipeline, not styling.
 */
export function glyphSizePx(badgeDiameterPx: number): number {
  return Math.round(badgeDiameterPx * GLYPH_SIZE_RATIO);
}

/**
 * Tier onto the rarity vocabulary the stats breakdown and the web
 * `AchievementBadge` still speak. Takes a plain number because callers read
 * the tier off wire-shaped data (`z.number()`), which cannot be narrowed to
 * `AchievementTier` at the type level.
 */
export function tierToRarity(
  tier: number | null | undefined,
): "common" | "rare" | "epic" | "legendary" {
  switch (tier) {
    case 2:
      return "rare";
    case 3:
      return "epic";
    case 4:
      return "legendary";
    default:
      return "common";
  }
}
