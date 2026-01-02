import { z } from "zod";

/**
 * Leaderboard entry
 */
export const LeaderboardEntrySchema = z.object({
  userId: z.uuid(),
  username: z.string(),
  fullName: z.string().nullable(),
  avatarUrl: z.url().nullable(),
  daysAttended: z.number().int(),
  totalBeers: z.number().int(),
  avgBeers: z.number(),
  position: z.number().int(),
  groupCount: z.number().int().optional(),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

/**
 * Global leaderboard query
 * GET /api/v1/leaderboard
 */
export const GlobalLeaderboardQuerySchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  sortBy: z.enum(["days_attended", "total_beers", "avg_beers"]).default("total_beers"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type GlobalLeaderboardQuery = z.infer<typeof GlobalLeaderboardQuerySchema>;

/**
 * Group leaderboard query
 * GET /api/v1/groups/:id/leaderboard
 */
export const GroupLeaderboardQuerySchema = z.object({
  sortBy: z.enum(["days_attended", "total_beers", "avg_beers"]).optional(),
});

export type GroupLeaderboardQuery = z.infer<typeof GroupLeaderboardQuerySchema>;

/**
 * Leaderboard response
 */
export const LeaderboardResponseSchema = z.object({
  data: z.array(LeaderboardEntrySchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

/**
 * Winning criteria option (database record for group competitions)
 * Different from WinningCriteria enum in group.schema.ts which is the string type
 */
export const WinningCriteriaOptionSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

export type WinningCriteriaOption = z.infer<typeof WinningCriteriaOptionSchema>;

export const WinningCriteriaListResponseSchema = z.object({
  data: z.array(WinningCriteriaOptionSchema),
});

export type WinningCriteriaListResponse = z.infer<
  typeof WinningCriteriaListResponseSchema
>;
