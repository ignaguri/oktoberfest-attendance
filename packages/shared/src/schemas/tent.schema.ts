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
 * Tent with location coordinates
 */
export const TentWithLocationSchema = TentSchema.extend({
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

export type TentWithLocation = z.infer<typeof TentWithLocationSchema>;

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

/**
 * Nearby tent schema - includes distance information
 */
export const NearbyTentSchema = z.object({
  tentId: z.uuid(),
  tentName: z.string(),
  category: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  distanceMeters: z.number(),
  beerPrice: z.number().nullable(),
});

export type NearbyTent = z.infer<typeof NearbyTentSchema>;

/**
 * Query parameters for nearby tents
 * GET /api/v1/tents/nearby
 */
export const GetNearbyTentsQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce
    .number()
    .int()
    .min(10)
    .max(2000)
    .optional()
    .default(250),
  festivalId: z.uuid({ error: "Invalid festival ID" }).optional(),
});

export type GetNearbyTentsQuery = z.infer<typeof GetNearbyTentsQuerySchema>;

/**
 * Response schema for nearby tents
 */
export const GetNearbyTentsResponseSchema = z.object({
  tents: z.array(NearbyTentSchema),
  userLocation: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  radiusMeters: z.number().int(),
});

export type GetNearbyTentsResponse = z.infer<
  typeof GetNearbyTentsResponseSchema
>;
