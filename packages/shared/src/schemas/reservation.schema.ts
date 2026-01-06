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
  id: z.uuid(),
  userId: z.uuid(),
  festivalId: z.uuid(),
  tentId: z.uuid(),
  tentName: z.string().optional(), // Enriched from tent data
  startAt: z.iso.datetime(),
  endAt: z.iso.datetime().nullable(),
  status: ReservationStatusSchema,
  note: z.string().nullable(),
  visibleToGroups: z.boolean(),
  autoCheckin: z.boolean(),
  reminderOffsetMinutes: z.number().int(),
  reminderSentAt: z.iso.datetime().nullable(),
  promptSentAt: z.iso.datetime().nullable(),
  processedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime().nullable(),
});

export type Reservation = z.infer<typeof ReservationSchema>;

/**
 * Create reservation request
 * POST /api/v1/reservations
 */
export const CreateReservationSchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  tentId: z.uuid({ error: "Invalid tent ID" }),
  startAt: z.iso.datetime({ error: "Invalid start time" }),
  endAt: z.iso.datetime({ error: "Invalid end time" }).optional(),
  note: z.string().max(500).optional(),
  visibleToGroups: z.boolean().optional().default(true),
  autoCheckin: z.boolean().optional().default(false),
  reminderOffsetMinutes: z
    .number()
    .int()
    .min(0)
    .max(1440)
    .optional()
    .default(30), // 30 minutes default
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

/**
 * Create reservation response
 */
export const CreateReservationResponseSchema = z.object({
  reservation: ReservationSchema,
});

export type CreateReservationResponse = z.infer<
  typeof CreateReservationResponseSchema
>;

/**
 * Check-in to reservation request
 * POST /api/v1/reservations/:id/checkin
 */
export const CheckinReservationSchema = z.object({
  reservationId: z.uuid({ error: "Invalid reservation ID" }),
});

export type CheckinReservationInput = z.infer<typeof CheckinReservationSchema>;

/**
 * Check-in to reservation response
 */
export const CheckinReservationResponseSchema = z.object({
  reservation: ReservationSchema,
  attendance: z
    .object({
      id: z.uuid(),
      date: z.iso.date(),
    })
    .optional(), // Created attendance if check-in creates one
});

export type CheckinReservationResponse = z.infer<
  typeof CheckinReservationResponseSchema
>;

/**
 * Get user reservations query
 * GET /api/v1/reservations
 */
export const GetReservationsQuerySchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }).optional(),
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

export type GetReservationsResponse = z.infer<
  typeof GetReservationsResponseSchema
>;

/**
 * Get single reservation param
 * GET /api/v1/reservations/:id
 */
export const ReservationIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid reservation ID" }),
});

export type ReservationIdParam = z.infer<typeof ReservationIdParamSchema>;

/**
 * Get single reservation response
 */
export const GetReservationResponseSchema = z.object({
  reservation: ReservationSchema,
});

export type GetReservationResponse = z.infer<
  typeof GetReservationResponseSchema
>;

/**
 * Update reservation request
 * PUT /api/v1/reservations/:id
 */
export const UpdateReservationSchema = z.object({
  startAt: z.iso.datetime({ error: "Invalid start time" }).optional(),
  endAt: z.iso.datetime({ error: "Invalid end time" }).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  visibleToGroups: z.boolean().optional(),
  autoCheckin: z.boolean().optional(),
  reminderOffsetMinutes: z.number().int().min(0).max(1440).optional(),
});

export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;

/**
 * Update reservation response
 */
export const UpdateReservationResponseSchema = z.object({
  reservation: ReservationSchema,
});

export type UpdateReservationResponse = z.infer<
  typeof UpdateReservationResponseSchema
>;
