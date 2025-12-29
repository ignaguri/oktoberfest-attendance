import { z } from "zod";

/**
 * Reservation status enum
 */
export const ReservationStatusSchema = z.enum([
  "pending",
  "confirmed",
  "checked_in",
  "cancelled",
  "expired",
]);

export type ReservationStatus = z.infer<typeof ReservationStatusSchema>;

/**
 * Reservation data schema
 */
export const ReservationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  festivalId: z.string().uuid(),
  tentId: z.string().uuid(),
  tentName: z.string().optional(), // Enriched from tent data
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable(),
  status: ReservationStatusSchema,
  note: z.string().nullable(),
  visibleToGroups: z.boolean(),
  autoCheckin: z.boolean(),
  reminderOffsetMinutes: z.number().int(),
  reminderSentAt: z.string().datetime().nullable(),
  promptSentAt: z.string().datetime().nullable(),
  processedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
});

export type Reservation = z.infer<typeof ReservationSchema>;

/**
 * Create reservation request
 * POST /api/v1/reservations
 */
export const CreateReservationSchema = z.object({
  festivalId: z.string().uuid("Invalid festival ID"),
  tentId: z.string().uuid("Invalid tent ID"),
  startAt: z.string().datetime("Invalid start time"),
  endAt: z.string().datetime("Invalid end time").optional(),
  note: z.string().max(500).optional(),
  visibleToGroups: z.boolean().optional().default(true),
  autoCheckin: z.boolean().optional().default(false),
  reminderOffsetMinutes: z.number().int().min(0).max(1440).optional().default(30), // 30 minutes default
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

/**
 * Create reservation response
 */
export const CreateReservationResponseSchema = z.object({
  reservation: ReservationSchema,
});

export type CreateReservationResponse = z.infer<typeof CreateReservationResponseSchema>;

/**
 * Check-in to reservation request
 * POST /api/v1/reservations/:id/checkin
 */
export const CheckinReservationSchema = z.object({
  reservationId: z.string().uuid("Invalid reservation ID"),
});

export type CheckinReservationInput = z.infer<typeof CheckinReservationSchema>;

/**
 * Check-in to reservation response
 */
export const CheckinReservationResponseSchema = z.object({
  reservation: ReservationSchema,
  attendance: z.object({
    id: z.string().uuid(),
    date: z.string().date(),
  }).optional(), // Created attendance if check-in creates one
});

export type CheckinReservationResponse = z.infer<typeof CheckinReservationResponseSchema>;

/**
 * Get user reservations query
 * GET /api/v1/reservations
 */
export const GetReservationsQuerySchema = z.object({
  festivalId: z.string().uuid("Invalid festival ID").optional(),
  status: ReservationStatusSchema.optional(),
  upcoming: z.coerce.boolean().optional(), // Only future reservations
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type GetReservationsQuery = z.infer<typeof GetReservationsQuerySchema>;

/**
 * Get user reservations response
 */
export const GetReservationsResponseSchema = z.object({
  reservations: z.array(ReservationSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

export type GetReservationsResponse = z.infer<typeof GetReservationsResponseSchema>;
