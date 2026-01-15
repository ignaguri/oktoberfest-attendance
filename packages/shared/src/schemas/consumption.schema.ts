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
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  tentId: z.uuid({ error: "Invalid tent ID" }).optional(),
  drinkType: DrinkTypeSchema.default("beer"),
  drinkName: z.string().max(255).optional(),
  basePriceCents: z
    .number()
    .int()
    .min(0, "Price must be non-negative")
    .optional(),
  pricePaidCents: z.number().int().min(0, "Price must be non-negative"),
  volumeMl: z.number().int().min(1, "Volume must be positive").default(1000),
  recordedAt: z.iso.datetime().optional(),
  idempotencyKey: z.string().max(255).optional(),
});

export type LogConsumptionInput = z.infer<typeof LogConsumptionSchema>;

/**
 * Schema for consumption response
 */
export const ConsumptionSchema = z.object({
  id: z.uuid(),
  attendanceId: z.uuid(),
  tentId: z.uuid().nullable(),
  drinkType: DrinkTypeSchema,
  drinkName: z.string().nullable(),
  basePriceCents: z.number().int(),
  pricePaidCents: z.number().int(),
  tipCents: z.number().int().nullable(),
  volumeMl: z.number().int().nullable(),
  recordedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Consumption = z.infer<typeof ConsumptionSchema>;

/**
 * Schema for tent visit (simplified for attendance response)
 */
export const TentVisitSchema = z.object({
  tentId: z.uuid(),
  visitDate: z.iso.datetime(),
  tentName: z.string().nullable(),
});

export type TentVisit = z.infer<typeof TentVisitSchema>;

/**
 * Schema for attendance with computed totals
 */
export const AttendanceWithTotalsSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  festivalId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  // Computed fields from consumptions
  drinkCount: z.number().int(),
  beerCount: z.number().int(),
  // Spending breakdown (all in cents)
  totalSpentCents: z.number().int(), // Total price paid (includes tips)
  totalBaseCents: z.number().int(), // Base cost before tips
  totalTipCents: z.number().int(), // Tips given
  avgPriceCents: z.number().int(),
  // Enriched tent visits for this attendance date
  tentVisits: z.array(TentVisitSchema),
});

export type AttendanceWithTotals = z.infer<typeof AttendanceWithTotalsSchema>;

/**
 * Response schema for logging consumption
 * Returns the attendance record with updated totals
 */
export const LogConsumptionResponseSchema = AttendanceWithTotalsSchema;

export type LogConsumptionResponse = z.infer<
  typeof LogConsumptionResponseSchema
>;
