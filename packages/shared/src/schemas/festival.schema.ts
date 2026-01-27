import { z } from "zod";

/**
 * Festival status enum
 */
export const FestivalStatusSchema = z.enum(["upcoming", "active", "ended"]);

export type FestivalStatus = z.infer<typeof FestivalStatusSchema>;

/**
 * Festival schema
 */
export const FestivalSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  beerCost: z.number().int().nullable(),
  location: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  mapUrl: z.url().nullable(),
  isActive: z.boolean(),
  status: FestivalStatusSchema,
  timezone: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Festival = z.infer<typeof FestivalSchema>;

/**
 * Query parameters for listing festivals
 * GET /api/v1/festivals
 */
export const ListFestivalsQuerySchema = z.object({
  status: FestivalStatusSchema.optional(),
  isActive: z.coerce.boolean().optional(),
});

export type ListFestivalsQuery = z.infer<typeof ListFestivalsQuerySchema>;

/**
 * Response schema for listing festivals
 */
export const ListFestivalsResponseSchema = z.object({
  data: z.array(FestivalSchema),
});

export type ListFestivalsResponse = z.infer<typeof ListFestivalsResponseSchema>;

/**
 * Path parameters for festival by ID
 * GET /api/v1/festivals/:id
 */
export const FestivalIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid festival ID" }),
});

export type FestivalIdParam = z.infer<typeof FestivalIdParamSchema>;

/**
 * Response schema for getting a single festival
 */
export const GetFestivalResponseSchema = FestivalSchema;

export type GetFestivalResponse = z.infer<typeof GetFestivalResponseSchema>;
