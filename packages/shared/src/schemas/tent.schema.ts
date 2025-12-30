import { z } from "zod";

/**
 * Tent schema
 */
export const TentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  category: z.string().nullable(),
});

export type Tent = z.infer<typeof TentSchema>;

/**
 * Festival-specific tent pricing
 */
export const FestivalTentSchema = z.object({
  festivalId: z.uuid(),
  tentId: z.uuid(),
  beerPrice: z.number().nullable(),
  tent: TentSchema,
});

export type FestivalTent = z.infer<typeof FestivalTentSchema>;

/**
 * Query parameters for listing tents
 * GET /api/v1/tents
 */
export const ListTentsQuerySchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }).optional(),
});

export type ListTentsQuery = z.infer<typeof ListTentsQuerySchema>;

/**
 * Response schema for listing tents
 */
export const ListTentsResponseSchema = z.object({
  data: z.array(FestivalTentSchema),
});

export type ListTentsResponse = z.infer<typeof ListTentsResponseSchema>;
