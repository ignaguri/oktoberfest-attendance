// packages/shared/src/achievements/types.ts

/** The six categories, organised by what the user did. */
export type AchievementCategory =
  | "drinking"
  | "attendance"
  | "explorer"
  | "social"
  | "competitive"
  | "dedication";

/** Festival-scoped achievements re-earn each festival; lifetime ones unlock once. */
export type AchievementScope = "festival" | "lifetime";

/** 1 = bronze, 2 = silver, 3 = gold, 4 = platinum. */
export type AchievementTier = 1 | 2 | 3 | 4;

export const TIER_NAMES = {
  1: "bronze",
  2: "silver",
  3: "gold",
  4: "platinum",
} as const satisfies Record<AchievementTier, string>;

/**
 * Every metric returned by the SQL function get_achievement_metrics.
 * Numeric metrics are counts or summed amounts; boolean metrics are one-shot facts.
 * Adding a key here without adding it to the SQL function will produce metrics
 * of 0/false at runtime, so the two must be changed together.
 */
export interface AchievementMetrics {
  // --- festival-scoped, numeric ---
  drinks_total: number;
  drinks_day_max: number;
  drink_types_distinct: number;
  volume_ml_total: number;
  tip_cents_total: number;
  spend_cents_total: number;
  days_attended: number;
  attendance_streak_max: number;
  tents_distinct: number;
  groups_joined: number;
  photos_uploaded: number;
  reactions_given: number;
  crowd_reports: number;

  // --- lifetime, numeric ---
  festivals_attended: number;
  festival_types_distinct: number;
  friends_accepted: number;
  group_wins: number;
  podium_finishes: number;
  active_days_total: number;
  active_day_streak_max: number;

  // --- festival-scoped, boolean ---
  attended_opening_day: boolean;
  attended_closing_day: boolean;
  attended_every_day: boolean;
  attended_every_weekend_day: boolean;
  visited_all_large_tents: boolean;
  created_group: boolean;

  // --- lifetime, boolean ---
  logged_first_drink: boolean;
  uploaded_first_photo: boolean;
  profile_complete: boolean;
  wrapped_viewed: boolean;
}

export type MetricKey = keyof AchievementMetrics;

export type NumericMetricKey = {
  [K in MetricKey]: AchievementMetrics[K] extends number ? K : never;
}[MetricKey];

export type BooleanMetricKey = {
  [K in MetricKey]: AchievementMetrics[K] extends boolean ? K : never;
}[MetricKey];

export interface TierDef {
  tier: AchievementTier;
  /** Value of the series metric at which this tier unlocks. */
  target: number;
  points: number;
}

export interface AchievementSeries {
  /** Stable identifier, also the i18n key root and the DB series_id. */
  id: string;
  category: AchievementCategory;
  scope: AchievementScope;
  metric: NumericMetricKey;
  /** Glyph identifier. Plan 3 supplies the artwork; this is just a string here. */
  glyph: string;
  tiers: [TierDef, TierDef, TierDef, TierDef];
}

export interface AchievementOneOff {
  id: string;
  category: AchievementCategory;
  scope: AchievementScope;
  metric: BooleanMetricKey;
  /** Difficulty, which drives the badge frame. Not a position in a ladder. */
  tier: AchievementTier;
  glyph: string;
  points: number;
}

export type AchievementDefinition = AchievementSeries | AchievementOneOff;

/** Narrowing helper: series have tiers, one-offs do not. */
export function isSeries(def: AchievementDefinition): def is AchievementSeries {
  return "tiers" in def;
}

/** The DB slug for a given definition and tier. Series: "drinks_total.t3". One-off: its id. */
export function slugFor(def: AchievementDefinition, tier?: AchievementTier): string {
  if (isSeries(def)) {
    if (tier === undefined) {
      throw new Error(`slugFor requires a tier for series "${def.id}"`);
    }
    return `${def.id}.t${tier}`;
  }
  return def.id;
}

export interface UnlockedAchievement {
  slug: string;
  seriesId: string | null;
  tier: AchievementTier;
  category: AchievementCategory;
  scope: AchievementScope;
  glyph: string;
  points: number;
}

export interface SeriesProgress {
  seriesId: string;
  category: AchievementCategory;
  scope: AchievementScope;
  glyph: string;
  /** Highest tier reached, or 0 if none. */
  currentTier: number;
  /** The next tier's target, or null once platinum is reached. */
  nextTarget: number | null;
  currentValue: number;
  /** 0-100, capped. 100 once platinum is reached. */
  percentage: number;
}
