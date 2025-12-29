import { z } from "zod";

/**
 * Leaderboard entry
 */
export const LeaderboardEntrySchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  daysAttended: z.number().int(),
  totalBeers: z.number().int(),
  avgBeers: z.number(),
  position: z.number().int(),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

/**
 * Global leaderboard query
 * GET /api/v1/leaderboard
 */
export const GlobalLeaderboardQuerySchema = z.object({
  festivalId: z.string().uuid("Invalid festival ID"),
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
