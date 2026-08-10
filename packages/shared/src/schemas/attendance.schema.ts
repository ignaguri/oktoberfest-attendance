import { z } from "zod";
import { AttendanceWithTotalsSchema, TentVisitRowSchema } from "./consumption.schema";

/**
 * Query parameters for listing attendances
 * GET /api/v1/attendance
 */
export const ListAttendancesQuerySchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  include: z.literal("tent_visits").optional(),
});

export type ListAttendancesQuery = z.infer<typeof ListAttendancesQuerySchema>;

/**
 * Response schema for listing attendances
 */
export const ListAttendancesResponseSchema = z.object({
  data: z.array(AttendanceWithTotalsSchema),
  tentVisits: z.array(TentVisitRowSchema).optional(),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

export type ListAttendancesResponse = z.infer<typeof ListAttendancesResponseSchema>;

/**
 * Path parameters for attendance by ID
 * DELETE /api/v1/attendance/:id
 */
export const AttendanceIdParamSchema = z.object({
  id: z.uuid({ error: "Invalid attendance ID" }),
});

export type AttendanceIdParam = z.infer<typeof AttendanceIdParamSchema>;

/**
 * Response schema for delete operation
 */
export const DeleteAttendanceResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

export type DeleteAttendanceResponse = z.infer<typeof DeleteAttendanceResponseSchema>;

/**
 * Create/update attendance request
 * POST /api/v1/attendance
 */
export const CreateAttendanceSchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  tents: z.array(z.uuid()).default([]),
  amount: z.number().int().min(0).default(0),
});

export type CreateAttendanceInput = z.infer<typeof CreateAttendanceSchema>;

/**
 * Create attendance response
 */
export const CreateAttendanceResponseSchema = z.object({
  attendanceId: z.uuid(),
  tentsChanged: z.boolean(),
});

export type CreateAttendanceResponse = z.infer<typeof CreateAttendanceResponseSchema>;

/**
 * Update personal attendance request (no notifications)
 * POST /api/v1/attendance/personal
 */
export const UpdatePersonalAttendanceSchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  /**
   * Tent visits to reconcile the day to.
   *
   * Deliberately optional rather than defaulting to `[]`: omitting it means
   * "leave tent visits alone", while an empty array means "the user cleared the
   * selection, remove them". Defaulting would make those indistinguishable and
   * turn any caller that loses the array into silent data loss.
   */
  tents: z.array(z.uuid()).optional(),
  amount: z.number().int().min(0).default(0),
});

export type UpdatePersonalAttendanceInput = z.infer<typeof UpdatePersonalAttendanceSchema>;

/**
 * Update personal attendance response
 */
export const UpdatePersonalAttendanceResponseSchema = z.object({
  attendanceId: z.uuid(),
  tentsAdded: z.array(z.uuid()),
  tentsRemoved: z.array(z.uuid()),
});

export type UpdatePersonalAttendanceResponse = z.infer<
  typeof UpdatePersonalAttendanceResponseSchema
>;

/**
 * Log one more visit to a tent
 * POST /api/v1/attendance/tent-visits
 *
 * Separate from UpdatePersonalAttendanceSchema because the two mean different
 * things. `tents` there is the set of tents the day should end up with, so
 * saving it twice is a no-op. This appends a visit, which is what makes
 * revisiting a tent later the same day (A, then B, then back to A) expressible
 * at all: a set cannot carry the second A.
 */
export const LogTentVisitSchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  tentId: z.uuid({ error: "Invalid tent ID" }),
  /**
   * When the visit happened.
   *
   * Sent by the client rather than defaulted to now() server-side so a device
   * that logs a visit offline at 20:00 and pushes it at midnight still records
   * 20:00, not the push time.
   */
  visitedAt: z.iso.datetime(),
});

export type LogTentVisitInput = z.infer<typeof LogTentVisitSchema>;

/**
 * Log tent visit response
 */
export const LogTentVisitResponseSchema = z.object({
  tentVisitId: z.uuid(),
  attendanceId: z.uuid(),
  visitedAt: z.iso.datetime(),
});

export type LogTentVisitResponse = z.infer<typeof LogTentVisitResponseSchema>;

/**
 * Check-in from reservation path param
 * POST /api/v1/attendance/check-in/{reservationId}
 */
export const CheckInFromReservationParamSchema = z.object({
  reservationId: z.uuid({ error: "Invalid reservation ID" }),
});

export type CheckInFromReservationParam = z.infer<typeof CheckInFromReservationParamSchema>;

/**
 * Check-in from reservation response
 */
export const CheckInFromReservationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  attendanceId: z.uuid().optional(),
});

/**
 * Query parameters for getting attendance by date
 * GET /api/v1/attendance/by-date
 */
export const GetAttendanceByDateQuerySchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

export type GetAttendanceByDateQuery = z.infer<typeof GetAttendanceByDateQuerySchema>;

/**
 * Picture reference with ID for deletion (minimal schema)
 */
export const PictureRefSchema = z.object({
  id: z.uuid(),
  pictureUrl: z.string(),
});

export type PictureRef = z.infer<typeof PictureRefSchema>;

/**
 * Attendance by date response - includes tent_ids and pictures
 */
export const AttendanceByDateSchema = AttendanceWithTotalsSchema.extend({
  tentIds: z.array(z.uuid()),
  pictureUrls: z.array(z.string()), // Kept for backward compatibility
  pictures: z.array(PictureRefSchema), // New: includes IDs for deletion
});

export type AttendanceByDate = z.infer<typeof AttendanceByDateSchema>;

/**
 * Response schema for get attendance by date
 */
export const GetAttendanceByDateResponseSchema = z.object({
  attendance: AttendanceByDateSchema.nullable(),
});

export type GetAttendanceByDateResponse = z.infer<typeof GetAttendanceByDateResponseSchema>;
