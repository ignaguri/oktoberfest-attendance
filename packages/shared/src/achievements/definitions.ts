// packages/shared/src/achievements/definitions.ts
import type { AchievementDefinition, AchievementOneOff, AchievementSeries } from "./types";
import { isSeries, slugFor } from "./types";

/**
 * Tiered series. Each measures one numeric metric across four rungs.
 * Targets are judgement calls pending validation against the Oktoberfest 2025
 * distribution (see the design doc, §13 item 2).
 */
export const SERIES: AchievementSeries[] = [
  // ---------------------------------------------------------------- drinking
  {
    id: "drinks_total",
    category: "drinking",
    scope: "festival",
    metric: "drinks_total",
    glyph: "masskrug",
    tiers: [
      { tier: 1, target: 3, points: 10 },
      { tier: 2, target: 10, points: 50 },
      { tier: 3, target: 25, points: 150 },
      { tier: 4, target: 50, points: 400 },
    ],
  },
  {
    id: "drinks_day_max",
    category: "drinking",
    scope: "festival",
    metric: "drinks_day_max",
    glyph: "sunburst-stein",
    tiers: [
      { tier: 1, target: 3, points: 15 },
      { tier: 2, target: 5, points: 60 },
      { tier: 3, target: 8, points: 160 },
      { tier: 4, target: 12, points: 420 },
    ],
  },
  {
    id: "drink_variety",
    category: "drinking",
    scope: "festival",
    metric: "drink_types_distinct",
    glyph: "three-glasses",
    tiers: [
      { tier: 1, target: 2, points: 10 },
      { tier: 2, target: 3, points: 45 },
      { tier: 3, target: 4, points: 120 },
      { tier: 4, target: 5, points: 300 },
    ],
  },
  {
    id: "volume_total",
    category: "drinking",
    scope: "festival",
    metric: "volume_ml_total",
    glyph: "measuring-jug",
    tiers: [
      { tier: 1, target: 5_000, points: 10 },
      { tier: 2, target: 20_000, points: 55 },
      { tier: 3, target: 50_000, points: 150 },
      { tier: 4, target: 100_000, points: 400 },
    ],
  },
  {
    id: "tips_total",
    category: "drinking",
    scope: "festival",
    metric: "tip_cents_total",
    glyph: "coin-hand",
    tiers: [
      { tier: 1, target: 500, points: 15 },
      { tier: 2, target: 2_000, points: 60 },
      { tier: 3, target: 5_000, points: 150 },
      { tier: 4, target: 10_000, points: 380 },
    ],
  },
  {
    id: "spend_total",
    category: "drinking",
    scope: "festival",
    metric: "spend_cents_total",
    glyph: "purse",
    tiers: [
      { tier: 1, target: 10_000, points: 15 },
      { tier: 2, target: 30_000, points: 65 },
      { tier: 3, target: 60_000, points: 170 },
      { tier: 4, target: 100_000, points: 450 },
    ],
  },

  // -------------------------------------------------------------- attendance
  {
    id: "days_attended",
    category: "attendance",
    scope: "festival",
    metric: "days_attended",
    glyph: "calendar-check",
    tiers: [
      { tier: 1, target: 1, points: 10 },
      { tier: 2, target: 3, points: 50 },
      { tier: 3, target: 6, points: 150 },
      { tier: 4, target: 10, points: 400 },
    ],
  },
  {
    id: "attendance_streak",
    category: "attendance",
    scope: "festival",
    metric: "attendance_streak_max",
    glyph: "chain-links",
    tiers: [
      { tier: 1, target: 2, points: 20 },
      { tier: 2, target: 3, points: 70 },
      { tier: 3, target: 5, points: 180 },
      { tier: 4, target: 7, points: 450 },
    ],
  },

  // ---------------------------------------------------------------- explorer
  {
    id: "tents_visited",
    category: "explorer",
    scope: "festival",
    metric: "tents_distinct",
    glyph: "tent-peaks",
    tiers: [
      { tier: 1, target: 3, points: 15 },
      { tier: 2, target: 6, points: 60 },
      { tier: 3, target: 10, points: 160 },
      { tier: 4, target: 15, points: 400 },
    ],
  },
  {
    id: "festivals_attended",
    category: "explorer",
    scope: "lifetime",
    metric: "festivals_attended",
    glyph: "ferris-wheel",
    tiers: [
      { tier: 1, target: 1, points: 20 },
      { tier: 2, target: 3, points: 90 },
      { tier: 3, target: 5, points: 220 },
      { tier: 4, target: 8, points: 500 },
    ],
  },
  {
    id: "festival_types",
    category: "explorer",
    scope: "lifetime",
    metric: "festival_types_distinct",
    glyph: "compass-rose",
    tiers: [
      { tier: 1, target: 1, points: 15 },
      { tier: 2, target: 2, points: 70 },
      { tier: 3, target: 3, points: 190 },
      { tier: 4, target: 4, points: 450 },
    ],
  },

  // ------------------------------------------------------------------ social
  {
    id: "groups_joined",
    category: "social",
    scope: "festival",
    metric: "groups_joined",
    glyph: "three-figures",
    tiers: [
      { tier: 1, target: 1, points: 15 },
      { tier: 2, target: 2, points: 55 },
      { tier: 3, target: 4, points: 150 },
      { tier: 4, target: 6, points: 380 },
    ],
  },
  {
    id: "friends_added",
    category: "social",
    scope: "lifetime",
    metric: "friends_accepted",
    glyph: "clasped-hands",
    tiers: [
      { tier: 1, target: 1, points: 15 },
      { tier: 2, target: 5, points: 60 },
      { tier: 3, target: 15, points: 170 },
      { tier: 4, target: 30, points: 420 },
    ],
  },
  {
    id: "photos_uploaded",
    category: "social",
    scope: "festival",
    metric: "photos_uploaded",
    glyph: "camera-shutter",
    tiers: [
      { tier: 1, target: 1, points: 10 },
      { tier: 2, target: 10, points: 55 },
      { tier: 3, target: 25, points: 155 },
      { tier: 4, target: 50, points: 400 },
    ],
  },
  {
    id: "reactions_given",
    category: "social",
    scope: "festival",
    metric: "reactions_given",
    glyph: "spark-heart",
    tiers: [
      { tier: 1, target: 5, points: 10 },
      { tier: 2, target: 25, points: 50 },
      { tier: 3, target: 75, points: 140 },
      { tier: 4, target: 150, points: 350 },
    ],
  },

  // ------------------------------------------------------------- competitive
  {
    id: "group_wins",
    category: "competitive",
    scope: "lifetime",
    metric: "group_wins",
    glyph: "laurel-cup",
    tiers: [
      { tier: 1, target: 1, points: 40 },
      { tier: 2, target: 3, points: 130 },
      { tier: 3, target: 6, points: 300 },
      { tier: 4, target: 10, points: 600 },
    ],
  },
  {
    id: "podium_finishes",
    category: "competitive",
    scope: "lifetime",
    metric: "podium_finishes",
    glyph: "podium-steps",
    tiers: [
      { tier: 1, target: 1, points: 25 },
      { tier: 2, target: 5, points: 100 },
      { tier: 3, target: 12, points: 250 },
      { tier: 4, target: 25, points: 550 },
    ],
  },

  // -------------------------------------------------------------- dedication
  {
    id: "active_days",
    category: "dedication",
    scope: "lifetime",
    metric: "active_days_total",
    glyph: "hourglass",
    tiers: [
      { tier: 1, target: 5, points: 10 },
      { tier: 2, target: 25, points: 50 },
      { tier: 3, target: 75, points: 150 },
      { tier: 4, target: 200, points: 400 },
    ],
  },
  {
    id: "active_day_streak",
    category: "dedication",
    scope: "lifetime",
    metric: "active_day_streak_max",
    glyph: "flame-steady",
    tiers: [
      { tier: 1, target: 3, points: 15 },
      { tier: 2, target: 7, points: 65 },
      { tier: 3, target: 21, points: 180 },
      { tier: 4, target: 60, points: 480 },
    ],
  },
  {
    id: "crowd_reports",
    category: "dedication",
    scope: "festival",
    metric: "crowd_reports",
    glyph: "signal-flag",
    tiers: [
      { tier: 1, target: 1, points: 10 },
      { tier: 2, target: 5, points: 45 },
      { tier: 3, target: 15, points: 130 },
      { tier: 4, target: 30, points: 330 },
    ],
  },
];

/** One-shot achievements. Their tier encodes difficulty, not ladder position. */
export const ONE_OFFS: AchievementOneOff[] = [
  {
    id: "first_drink",
    category: "drinking",
    scope: "lifetime",
    metric: "logged_first_drink",
    tier: 1,
    glyph: "first-drop",
    points: 10,
  },
  {
    id: "opening_day",
    category: "attendance",
    scope: "festival",
    metric: "attended_opening_day",
    tier: 2,
    glyph: "sunrise-gate",
    points: 80,
  },
  {
    id: "closing_day",
    category: "attendance",
    scope: "festival",
    metric: "attended_closing_day",
    tier: 2,
    glyph: "sunset-gate",
    points: 80,
  },
  {
    id: "every_weekend_day",
    category: "attendance",
    scope: "festival",
    metric: "attended_every_weekend_day",
    tier: 3,
    glyph: "double-sun",
    points: 220,
  },
  {
    id: "full_festival",
    category: "attendance",
    scope: "festival",
    metric: "attended_every_day",
    tier: 4,
    glyph: "wiesn-crown",
    points: 600,
  },
  {
    id: "all_large_tents",
    category: "explorer",
    scope: "festival",
    metric: "visited_all_large_tents",
    tier: 4,
    glyph: "tent-ring",
    points: 550,
  },
  {
    id: "first_photo",
    category: "social",
    scope: "lifetime",
    metric: "uploaded_first_photo",
    tier: 1,
    glyph: "polaroid",
    points: 10,
  },
  {
    id: "created_group",
    category: "social",
    scope: "festival",
    metric: "created_group",
    tier: 2,
    glyph: "banner-pole",
    points: 70,
  },
  {
    id: "profile_complete",
    category: "dedication",
    scope: "lifetime",
    metric: "profile_complete",
    tier: 1,
    glyph: "id-card",
    points: 15,
  },
  {
    id: "wrapped_viewed",
    category: "dedication",
    scope: "lifetime",
    metric: "wrapped_viewed",
    tier: 2,
    glyph: "ribbon-scroll",
    points: 60,
  },
];

export const ALL_DEFINITIONS: AchievementDefinition[] = [...SERIES, ...ONE_OFFS];

/** Every unlockable slug: 20 series x 4 tiers, plus 10 one-offs = 90. */
export const ALL_SLUGS: string[] = ALL_DEFINITIONS.flatMap((def) => {
  if (isSeries(def)) {
    return def.tiers.map((tierDef) => slugFor(def, tierDef.tier));
  }
  return [slugFor(def)];
});
