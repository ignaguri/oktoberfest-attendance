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

/**
 * Lighter companion to a category colour, used for the `tint` tone of an
 * achievement glyph (see `GLYPH_PATHS`). Mixing towards white rather than
 * dropping opacity keeps the hue intact: a translucent fill takes on
 * whatever sits behind it, which turned orange into brown on a dark ground.
 *
 * Both apps currently render light-only, so this is the light-ground ratio.
 * A dark ground wants a much smaller mix (about 0.35) — the glyph needs to
 * stay brighter than its background, not paler.
 */
const TINT_MIX_TOWARDS_WHITE = 0.62;

export function getCategoryTintColor(category: string): string {
  const base = getCategoryColor(category);
  const channels = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16));
  return `#${channels
    .map((channel) =>
      Math.round(channel + (255 - channel) * TINT_MIX_TOWARDS_WHITE)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
