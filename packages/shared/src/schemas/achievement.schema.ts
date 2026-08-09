import { z } from "zod";

/**
 * Achievement category enum
 */
export const AchievementCategorySchema = z.enum([
  "consumption",
  "attendance",
  "explorer",
  "social",
  "competitive",
  "special",
  "drinking",
  "dedication",
]);

export type AchievementCategory = z.infer<typeof AchievementCategorySchema>;

/**
 * Achievement rarity enum
 */
export const AchievementRaritySchema = z.enum(["common", "rare", "epic", "legendary"]);

export type AchievementRarity = z.infer<typeof AchievementRaritySchema>;

/**
 * The six live achievement categories, matching the `AchievementCategory` TS
 * type in packages/shared/src/achievements/types.ts.
 *
 * Deliberately separate from `AchievementCategorySchema` above, which is the
 * wider legacy database enum: it also carries `consumption` and `special`,
 * two buckets nothing can be filed under any more but old rows still use.
 * Anything describing the current engine uses this narrower schema.
 */
export const SeriesCategorySchema = z.enum([
  "drinking",
  "attendance",
  "explorer",
  "social",
  "competitive",
  "dedication",
]);

export type SeriesCategory = z.infer<typeof SeriesCategorySchema>;

/** Festival-scoped achievements re-earn each festival; lifetime ones unlock once. */
export const SeriesScopeSchema = z.enum(["festival", "lifetime"]);

export type SeriesScope = z.infer<typeof SeriesScopeSchema>;

/**
 * Achievement schema
 */
export const AchievementSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  category: AchievementCategorySchema,
  icon: z.string(),
  points: z.number().int(),
  rarity: AchievementRaritySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Achievement = z.infer<typeof AchievementSchema>;

/**
 * User achievement (unlocked)
 */
export const UserAchievementSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  achievementId: z.uuid(),
  festivalId: z.uuid(),
  rarity: AchievementRaritySchema,
  unlockedAt: z.iso.datetime(),
  userNotifiedAt: z.iso.datetime().nullable(),
  groupNotifiedAt: z.iso.datetime().nullable(),
  achievement: AchievementSchema,
});

export type UserAchievement = z.infer<typeof UserAchievementSchema>;

/**
 * List achievements query
 * GET /api/v1/achievements
 */
export const ListAchievementsQuerySchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  category: AchievementCategorySchema.optional(),
});

export type ListAchievementsQuery = z.infer<typeof ListAchievementsQuerySchema>;

/**
 * List achievements response
 */
export const ListAchievementsResponseSchema = z.object({
  data: z.array(UserAchievementSchema),
});

export type ListAchievementsResponse = z.infer<typeof ListAchievementsResponseSchema>;

/**
 * Evaluate achievements request
 * POST /api/v1/achievements/evaluate
 */
export const EvaluateAchievementsSchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
});

export type EvaluateAchievementsInput = z.infer<typeof EvaluateAchievementsSchema>;

/**
 * Evaluate achievements response
 */
export const EvaluateAchievementsResponseSchema = z.object({
  newAchievements: z.array(UserAchievementSchema),
  totalPoints: z.number().int(),
});

export type EvaluateAchievementsResponse = z.infer<typeof EvaluateAchievementsResponseSchema>;

/**
 * One rung of a card. For a tiered series this is one of four; for a one-off
 * it is the only entry, and its `tier` is the one-off's difficulty rather
 * than a position in a ladder.
 */
export const SeriesTierSchema = z.object({
  tier: z.number().int().min(1).max(4),
  /** i18n key, e.g. "achievements.drinks_total.t2.name". */
  name: z.string(),
  points: z.number().int(),
  isUnlocked: z.boolean(),
  unlockedAt: z.iso.datetime().nullable(),
});

export type SeriesTier = z.infer<typeof SeriesTierSchema>;

/**
 * One card on the achievements screen. Covers both tiered series and one-offs:
 * a one-off is the same shape with `tiers.length === 1`, which is also the only
 * discriminant callers need.
 *
 * `tiers` is enforced non-empty and `currentTier` is enforced not to exceed
 * `tiers.length` so `getActiveTier()` can safely index `tiers[currentTier - 1]`
 * without an out-of-bounds read.
 */
export const SeriesCardSchema = z
  .object({
    /** The series id for a series, the one-off's own id otherwise. */
    id: z.string(),
    category: SeriesCategorySchema,
    scope: SeriesScopeSchema,
    glyph: z.string(),
    /**
     * Rungs cleared, 0 when nothing is unlocked yet. NOT the badge tier: for a
     * one-off this is 0 or 1 while its difficulty lives in `tiers[0].tier`.
     * Anything user-visible reads getActiveTier(card).tier instead.
     */
    currentTier: z.number().int().min(0).max(4),
    tiers: z.array(SeriesTierSchema).min(1),
    /**
     * Progress toward the rung after the last one the user holds. Null for
     * one-offs (binary — no partial state) and for series with every rung
     * unlocked.
     *
     * `nextTarget` is the definition's target for tier `currentTier + 1`, not
     * the metrics-derived target: the two diverge while metrics run ahead of
     * unlock rows, and the definition answer is the one that agrees with the
     * pips. `currentValue` is capped at `nextTarget` by the builder, so
     * `nextTarget - currentValue` is never negative.
     */
    progress: z
      .object({
        currentValue: z.number().nonnegative(),
        nextTarget: z.number().positive(),
      })
      .refine((progress) => progress.currentValue <= progress.nextTarget, {
        message: "currentValue cannot exceed nextTarget",
        path: ["currentValue"],
      })
      .nullable(),
  })
  .refine((card) => card.currentTier <= card.tiers.length, {
    message: "currentTier cannot exceed the number of tiers",
    path: ["currentTier"],
  });

export type SeriesCard = z.infer<typeof SeriesCardSchema>;

/** A single unlocked rung, newest-first, for the home screen highlight. */
export const RecentUnlockSchema = z.object({
  /** The unlock's slug: "drinks_total.t2" for a series, "first_drink" for a one-off. */
  id: z.string(),
  /** i18n key of the specific tier that unlocked. */
  name: z.string(),
  glyph: z.string(),
  category: SeriesCategorySchema,
  tier: z.number().int().min(1).max(4),
  scope: SeriesScopeSchema,
  points: z.number().int(),
  unlockedAt: z.iso.datetime(),
});

export type RecentUnlock = z.infer<typeof RecentUnlockSchema>;

/**
 * Category/rarity breakdown stats
 */
export const BreakdownStatsSchema = z.object({
  total: z.number().int(),
  unlocked: z.number().int(),
  points: z.number().int(),
});

export type BreakdownStats = z.infer<typeof BreakdownStatsSchema>;

/**
 * Achievement stats
 */
export const AchievementStatsSchema = z.object({
  total_achievements: z.number().int(),
  unlocked_achievements: z.number().int(),
  total_points: z.number().int(),
  breakdown_by_category: z.record(SeriesCategorySchema, BreakdownStatsSchema),
  breakdown_by_rarity: z.record(AchievementRaritySchema, BreakdownStatsSchema),
});

export type AchievementStats = z.infer<typeof AchievementStatsSchema>;

/**
 * Achievement leaderboard entry
 */
export const AchievementLeaderboardEntrySchema = z.object({
  user_id: z.string().uuid(),
  username: z.string().nullable(),
  full_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  total_achievements: z.number().int(),
  total_points: z.number().int(),
});

export type AchievementLeaderboardEntry = z.infer<typeof AchievementLeaderboardEntrySchema>;

/**
 * GET /achievements/with-progress response
 *
 * `cards` holds one entry per definition — 20 tiered series then 10 one-offs,
 * in definition order. Consumers rely on that order as the tie-break when
 * sorting cards of equal tier, so the route must not reorder it.
 */
export const GetAchievementsWithProgressResponseSchema = z.object({
  cards: z.array(SeriesCardSchema),
  /** Newest unlocks first, capped at 10. */
  recentUnlocks: z.array(RecentUnlockSchema),
  stats: AchievementStatsSchema,
});

export type GetAchievementsWithProgressResponse = z.infer<
  typeof GetAchievementsWithProgressResponseSchema
>;

/**
 * GET /achievements/leaderboard response
 */
export const GetAchievementLeaderboardResponseSchema = z.object({
  data: z.array(AchievementLeaderboardEntrySchema),
});

export type GetAchievementLeaderboardResponse = z.infer<
  typeof GetAchievementLeaderboardResponseSchema
>;

/**
 * Available achievement (for listing all achievements)
 */
export const AvailableAchievementSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  category: AchievementCategorySchema,
  icon: z.string(),
  points: z.number().int(),
  rarity: AchievementRaritySchema,
  is_active: z.boolean(),
});

export type AvailableAchievement = z.infer<typeof AvailableAchievementSchema>;

/**
 * GET /achievements/available response
 */
export const ListAvailableAchievementsResponseSchema = z.object({
  data: z.array(AvailableAchievementSchema),
});

export type ListAvailableAchievementsResponse = z.infer<
  typeof ListAvailableAchievementsResponseSchema
>;

/**
 * A single achievement unlock, as returned inline from the write path
 * (e.g. POST /consumption) when logging an event unlocks something.
 */
export const UnlockedAchievementSchema = z.object({
  slug: z.string(),
  seriesId: z.string().nullable(),
  tier: z.number().int().min(1).max(4),
  category: SeriesCategorySchema,
  scope: SeriesScopeSchema,
  glyph: z.string(),
  points: z.number().int(),
});

export type UnlockedAchievement = z.infer<typeof UnlockedAchievementSchema>;
