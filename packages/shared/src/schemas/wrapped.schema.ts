import { z } from "zod";

/**
 * Wrapped data response schema
 * Represents the personalized year-in-review statistics
 */
export const WrappedDataSchema = z.object({
  userId: z.uuid(),
  festivalId: z.uuid(),
  totalDays: z.number().int(),
  totalBeers: z.number().int(),
  totalSpent: z.number(),
  avgBeersPerDay: z.number(),
  favoriteTent: z.object({
    id: z.uuid(),
    name: z.string(),
    visitCount: z.number().int(),
  }).nullable(),
  topDrinkType: z.string().nullable(),
  achievements: z.array(z.object({
    id: z.uuid(),
    name: z.string(),
    unlockedAt: z.iso.datetime(),
  })),
  globalRank: z.number().int().nullable(),
  groupRanks: z.array(z.object({
    groupId: z.uuid(),
    groupName: z.string(),
    rank: z.number().int(),
  })),
  firstVisitDate: z.iso.date().nullable(),
  lastVisitDate: z.iso.date().nullable(),
  longestStreak: z.number().int(),
  generatedAt: z.iso.datetime(),
});

export type WrappedData = z.infer<typeof WrappedDataSchema>;

/**
 * Get wrapped data query
 * GET /api/v1/wrapped/:festivalId
 */
export const GetWrappedQuerySchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
});

export type GetWrappedQuery = z.infer<typeof GetWrappedQuerySchema>;

/**
 * Get wrapped data response
 */
export const GetWrappedResponseSchema = z.object({
  wrapped: WrappedDataSchema.nullable(),
  cached: z.boolean(),
});

export type GetWrappedResponse = z.infer<typeof GetWrappedResponseSchema>;

/**
 * Generate wrapped data request
 * POST /api/v1/wrapped/:festivalId/generate
 */
export const GenerateWrappedBodySchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  force: z.boolean().optional().default(false), // Force regeneration even if cached
});

export type GenerateWrappedInput = z.infer<typeof GenerateWrappedBodySchema>;

/**
 * Generate wrapped data response
 */
export const GenerateWrappedResponseSchema = z.object({
  wrapped: WrappedDataSchema,
  regenerated: z.boolean(), // True if cache was invalidated and regenerated
});

export type GenerateWrappedResponse = z.infer<typeof GenerateWrappedResponseSchema>;

/**
 * Wrapped access result schema
 * GET /api/v1/wrapped/:festivalId/access
 */
export const WrappedAccessResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.enum(["not_ended", "no_data", "not_authenticated", "error"]).optional(),
  message: z.string().optional(),
});

export type WrappedAccessResult = z.infer<typeof WrappedAccessResultSchema>;

/**
 * Available wrapped festival schema
 * GET /api/v1/wrapped/festivals
 */
export const AvailableWrappedFestivalSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  year: z.number().int(),
  status: z.string(),
  hasData: z.boolean(),
});

export type AvailableWrappedFestival = z.infer<typeof AvailableWrappedFestivalSchema>;

export const GetAvailableWrappedFestivalsResponseSchema = z.object({
  festivals: z.array(AvailableWrappedFestivalSchema),
});

export type GetAvailableWrappedFestivalsResponse = z.infer<typeof GetAvailableWrappedFestivalsResponseSchema>;

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
