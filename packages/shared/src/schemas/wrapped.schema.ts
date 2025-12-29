import { z } from "zod";

/**
 * Wrapped data response schema
 * Represents the personalized year-in-review statistics
 */
export const WrappedDataSchema = z.object({
  userId: z.string().uuid(),
  festivalId: z.string().uuid(),
  totalDays: z.number().int(),
  totalBeers: z.number().int(),
  totalSpent: z.number(),
  avgBeersPerDay: z.number(),
  favoriteTent: z.object({
    id: z.string().uuid(),
    name: z.string(),
    visitCount: z.number().int(),
  }).nullable(),
  topDrinkType: z.string().nullable(),
  achievements: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    unlockedAt: z.string().datetime(),
  })),
  globalRank: z.number().int().nullable(),
  groupRanks: z.array(z.object({
    groupId: z.string().uuid(),
    groupName: z.string(),
    rank: z.number().int(),
  })),
  firstVisitDate: z.string().date().nullable(),
  lastVisitDate: z.string().date().nullable(),
  longestStreak: z.number().int(),
  generatedAt: z.string().datetime(),
});

export type WrappedData = z.infer<typeof WrappedDataSchema>;

/**
 * Get wrapped data query
 * GET /api/v1/wrapped/:festivalId
 */
export const GetWrappedQuerySchema = z.object({
  festivalId: z.string().uuid("Invalid festival ID"),
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
  festivalId: z.string().uuid("Invalid festival ID"),
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
