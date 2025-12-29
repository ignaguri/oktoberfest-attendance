import { z } from "zod";

/**
 * Drink type enum matching database enum
 */
export const DrinkTypeSchema = z.enum([
  "beer",
  "radler",
  "alcohol_free",
  "wine",
  "soft_drink",
  "other",
]);

export type DrinkType = z.infer<typeof DrinkTypeSchema>;

/**
 * Schema for logging a new consumption
 * POST /api/v1/consumption
 */
export const LogConsumptionSchema = z.object({
  festivalId: z.string().uuid("Invalid festival ID"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  tentId: z.string().uuid("Invalid tent ID").optional(),
  drinkType: DrinkTypeSchema.default("beer"),
  drinkName: z.string().max(255).optional(),
  basePriceCents: z.number().int().min(0, "Price must be non-negative").optional(),
  pricePaidCents: z.number().int().min(0, "Price must be non-negative"),
  volumeMl: z.number().int().min(1, "Volume must be positive").default(1000),
  recordedAt: z.string().datetime().optional(),
  idempotencyKey: z.string().max(255).optional(),
});

export type LogConsumptionInput = z.infer<typeof LogConsumptionSchema>;

/**
 * Schema for consumption response
 */
export const ConsumptionSchema = z.object({
  id: z.string().uuid(),
  attendanceId: z.string().uuid(),
  tentId: z.string().uuid().nullable(),
  drinkType: DrinkTypeSchema,
  drinkName: z.string().nullable(),
  basePriceCents: z.number().int(),
  pricePaidCents: z.number().int(),
  tipCents: z.number().int().nullable(),
  volumeMl: z.number().int().nullable(),
  recordedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Consumption = z.infer<typeof ConsumptionSchema>;

/**
 * Schema for attendance with computed totals
 */
export const AttendanceWithTotalsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  festivalId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Computed fields from consumptions
  drinkCount: z.number().int(),
  beerCount: z.number().int(),
  totalSpentCents: z.number().int(),
  totalTipCents: z.number().int(),
  avgPriceCents: z.number().int(),
});

export type AttendanceWithTotals = z.infer<typeof AttendanceWithTotalsSchema>;

/**
 * Response schema for logging consumption
 * Returns the attendance record with updated totals
 */
export const LogConsumptionResponseSchema = AttendanceWithTotalsSchema;

export type LogConsumptionResponse = z.infer<typeof LogConsumptionResponseSchema>;
