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
]);

export type AchievementCategory = z.infer<typeof AchievementCategorySchema>;

/**
 * Achievement rarity enum
 */
export const AchievementRaritySchema = z.enum([
  "common",
  "rare",
  "epic",
  "legendary",
]);

export type AchievementRarity = z.infer<typeof AchievementRaritySchema>;

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
  condition: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
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

export type ListAchievementsResponse = z.infer<
  typeof ListAchievementsResponseSchema
>;

/**
 * Evaluate achievements request
 * POST /api/v1/achievements/evaluate
 */
export const EvaluateAchievementsSchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
});

export type EvaluateAchievementsInput = z.infer<
  typeof EvaluateAchievementsSchema
>;

/**
 * Evaluate achievements response
 */
export const EvaluateAchievementsResponseSchema = z.object({
  newAchievements: z.array(UserAchievementSchema),
  totalPoints: z.number().int(),
});

export type EvaluateAchievementsResponse = z.infer<
  typeof EvaluateAchievementsResponseSchema
>;

/**
 * Achievement progress (for locked achievements)
 */
export const AchievementProgressSchema = z.object({
  current_value: z.number(),
  target_value: z.number(),
  percentage: z.number(),
  last_updated: z.string(),
});

export type AchievementProgress = z.infer<typeof AchievementProgressSchema>;

/**
 * Achievement with progress (includes both locked and unlocked)
 */
export const AchievementWithProgressSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  category: AchievementCategorySchema,
  icon: z.string(),
  points: z.number().int(),
  rarity: AchievementRaritySchema,
  conditions: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  is_unlocked: z.boolean(),
  unlocked_at: z.string().nullable().optional(),
  user_progress: AchievementProgressSchema.optional(),
});

export type AchievementWithProgress = z.infer<
  typeof AchievementWithProgressSchema
>;

/**
 * Category/rarity breakdown stats
 */
export const BreakdownStatsSchema = z.object({
  total: z.number().int(),
  unlocked: z.number().int(),
  points: z.number().int(),
});

/**
 * Achievement stats
 */
export const AchievementStatsSchema = z.object({
  total_achievements: z.number().int(),
  unlocked_achievements: z.number().int(),
  total_points: z.number().int(),
  breakdown_by_category: z.record(AchievementCategorySchema, BreakdownStatsSchema),
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

export type AchievementLeaderboardEntry = z.infer<
  typeof AchievementLeaderboardEntrySchema
>;

/**
 * GET /achievements/with-progress response
 */
export const GetAchievementsWithProgressResponseSchema = z.object({
  data: z.array(AchievementWithProgressSchema),
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
