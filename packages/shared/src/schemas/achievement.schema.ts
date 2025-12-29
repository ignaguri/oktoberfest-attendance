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
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  category: AchievementCategorySchema,
  icon: z.string(),
  points: z.number().int(),
  rarity: AchievementRaritySchema,
  condition: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Achievement = z.infer<typeof AchievementSchema>;

/**
 * User achievement (unlocked)
 */
export const UserAchievementSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  achievementId: z.string().uuid(),
  festivalId: z.string().uuid(),
  rarity: AchievementRaritySchema,
  unlockedAt: z.string().datetime(),
  userNotifiedAt: z.string().datetime().nullable(),
  groupNotifiedAt: z.string().datetime().nullable(),
  achievement: AchievementSchema,
});

export type UserAchievement = z.infer<typeof UserAchievementSchema>;

/**
 * List achievements query
 * GET /api/v1/achievements
 */
export const ListAchievementsQuerySchema = z.object({
  festivalId: z.string().uuid("Invalid festival ID"),
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
  festivalId: z.string().uuid("Invalid festival ID"),
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
