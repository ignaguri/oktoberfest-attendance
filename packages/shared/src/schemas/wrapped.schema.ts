import { z } from "zod";

import { AchievementCategorySchema } from "./achievement.schema";

/**
 * Wrapped, camelCase. The get_wrapped_data RPC returns the same data in
 * snake_case (kept for installed mobile binaries that call it directly); the
 * API maps it with packages/api/src/repositories/supabase/wrapped-mapper.ts.
 *
 * Dates and timestamps are plain strings: jsonb and PostgREST emit offsets and
 * microseconds (2026-09-20T14:03:11.123456+00:00) that z.iso.datetime() rejects.
 * Numbers are not .int(): a Radler counts as half a beer.
 */
export const WrappedDataSchema = z.object({
  userInfo: z.object({
    username: z.string().nullable(),
    fullName: z.string().nullable(),
    avatarUrl: z.string().nullable(),
  }),
  festivalInfo: z.object({
    name: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    location: z.string().nullable(),
    // festivals.festival_type. A plain string: admin.schema's enum imports this file.
    festivalType: z.string(),
  }),
  basicStats: z.object({
    totalBeers: z.number(),
    daysAttended: z.number(),
    avgBeers: z.number(),
    totalSpent: z.number(),
    beerCost: z.number(),
  }),
  tentStats: z.object({
    uniqueTents: z.number(),
    favoriteTent: z.string().nullable(),
    tentDiversityPct: z.number(),
    tentBreakdown: z.array(z.object({ tentName: z.string(), visitCount: z.number() })),
  }),
  peakMoments: z.object({
    bestDay: z
      .object({
        date: z.string(),
        beerCount: z.number(),
        tentsVisited: z.number(),
        spent: z.number(),
      })
      .nullable(),
    maxSingleSession: z.number(),
    mostExpensiveDay: z.object({ date: z.string(), amount: z.number() }).nullable(),
  }),
  socialStats: z.object({
    groupsJoined: z.number(),
    topRankings: z.array(z.object({ groupName: z.string(), position: z.number() })),
    photosUploaded: z.number(),
    totalGroupMembers: z.number(),
    pictures: z.array(
      z.object({
        id: z.string(),
        pictureUrl: z.string(),
        createdAt: z.string(),
        attendanceDate: z.string(),
        /** Reactions + comments + 2x tags: how much friends engaged with it. */
        socialScore: z.number(),
      }),
    ),
  }),
  globalLeaderboardPositions: z.object({
    daysAttended: z.number().nullable(),
    totalBeers: z.number().nullable(),
    avgBeers: z.number().nullable(),
  }),
  achievements: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      icon: z.string(),
      category: AchievementCategorySchema,
      tier: z.number(),
      points: z.number(),
      rarity: z.string(),
      unlockedAt: z.string(),
    }),
  ),
  timeline: z.array(
    z.object({
      date: z.string(),
      beerCount: z.number(),
      spent: z.number(),
      tentsVisited: z.number(),
    }),
  ),
  comparisons: z.object({
    vsFestivalAvg: z.object({
      beersDiffPct: z.number(),
      daysDiffPct: z.number(),
      avgBeers: z.number(),
      avgDays: z.number(),
      medianBeers: z.number(),
      medianDays: z.number(),
      beersPercentile: z.number(),
      daysPercentile: z.number(),
      attendeeCount: z.number(),
    }),
    vsLastYear: z
      .object({
        beersDiff: z.number(),
        daysDiff: z.number(),
        spentDiff: z.number(),
        prevBeers: z.number(),
        prevDays: z.number(),
        prevFestivalName: z.string(),
      })
      .nullable(),
  }),
  personality: z.object({ type: z.string(), traits: z.array(z.string()) }),
  drinkStats: z.object({
    totalDrinks: z.number(),
    topDrinkType: z.string().nullable(),
    breakdown: z.array(
      z.object({ drinkType: z.string(), count: z.number(), percentage: z.number() }),
    ),
  }),
  timing: z.object({
    timedDays: z.number(),
    medianFirstHour: z.number().nullable(),
    medianLastHour: z.number().nullable(),
    peakHour: z.number().nullable(),
    weekendShare: z.number().nullable(),
  }),
});

export type WrappedData = z.infer<typeof WrappedDataSchema>;

/** One lost-and-found curiosity, a complete phrase in each locale. */
export const CuriousFindSchema = z.object({
  de: z.string().min(1).max(80),
  en: z.string().min(1).max(80),
  es: z.string().min(1).max(80),
});

export type CuriousFind = z.infer<typeof CuriousFindSchema>;

/**
 * The festival's official numbers, or last year's of the same series
 * (isCurrentFestival false). Read outside the Wrapped cache.
 */
export const WrappedOfficialStatsSchema = z.object({
  year: z.number().int(),
  isCurrentFestival: z.boolean(),
  visitors: z.number().nullable(),
  massServed: z.number().nullable(),
  mugsConfiscated: z.number().nullable(),
  lostItems: z.number().nullable(),
  curiousFinds: z.array(CuriousFindSchema).max(3),
  sourceUrl: z.url({ protocol: /^https?$/ }).nullable(),
});

export type WrappedOfficialStats = z.infer<typeof WrappedOfficialStatsSchema>;

/**
 * GET /api/v1/wrapped/:festivalId
 * 200 in every case; `status` says which. `unlocksAt` is an ISO string (Z).
 */
export const GetWrappedResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"),
    wrapped: WrappedDataSchema,
    officialStats: WrappedOfficialStatsSchema.nullable(),
  }),
  z.object({ status: z.literal("locked"), unlocksAt: z.string() }),
  z.object({ status: z.literal("not_attended") }),
]);

export type GetWrappedResponse = z.infer<typeof GetWrappedResponseSchema>;

/**
 * GET /api/v1/wrapped: every unlocked festival the user attended, newest first.
 */
export const WrappedFestivalSchema = z.object({
  festivalId: z.uuid(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  unlocksAt: z.string(),
  viewed: z.boolean(),
});

export type WrappedFestival = z.infer<typeof WrappedFestivalSchema>;

export const GetWrappedFestivalsResponseSchema = z.object({
  festivals: z.array(WrappedFestivalSchema),
});

export type GetWrappedFestivalsResponse = z.infer<typeof GetWrappedFestivalsResponseSchema>;

/**
 * GET /api/v1/wrapped/:festivalId/access
 * @deprecated Kept for installed binaries; new clients use GET /wrapped/:festivalId.
 */
export const WrappedAccessResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.enum(["not_ended", "no_data", "not_authenticated", "error"]).optional(),
  message: z.string().optional(),
});

export type WrappedAccessResult = z.infer<typeof WrappedAccessResultSchema>;

/**
 * Regenerate wrapped cache request (admin only)
 * POST /api/v1/wrapped/regenerate
 */
export const RegenerateWrappedCacheBodySchema = z.object({
  festivalId: z.uuid().optional(),
  userId: z.uuid().optional(),
});

export type RegenerateWrappedCacheInput = z.infer<typeof RegenerateWrappedCacheBodySchema>;

export const RegenerateWrappedCacheResponseSchema = z.object({
  success: z.boolean(),
  regeneratedCount: z.number().int().optional(),
  error: z.string().optional(),
});

export type RegenerateWrappedCacheResponse = z.infer<typeof RegenerateWrappedCacheResponseSchema>;
