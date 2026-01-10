import { z } from "zod";
import { AttendanceWithTotalsSchema } from "./consumption.schema";

/**
 * Query parameters for listing attendances
 * GET /api/v1/attendance
 */
export const ListAttendancesQuerySchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListAttendancesQuery = z.infer<typeof ListAttendancesQuerySchema>;

/**
 * Response schema for listing attendances
 */
export const ListAttendancesResponseSchema = z.object({
  data: z.array(AttendanceWithTotalsSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

export type ListAttendancesResponse = z.infer<
  typeof ListAttendancesResponseSchema
>;

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

export type DeleteAttendanceResponse = z.infer<
  typeof DeleteAttendanceResponseSchema
>;

/**
 * Create/update attendance request
 * POST /api/v1/attendance
 */
export const CreateAttendanceSchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
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

export type CreateAttendanceResponse = z.infer<
  typeof CreateAttendanceResponseSchema
>;

/**
 * Update personal attendance request (no notifications)
 * POST /api/v1/attendance/personal
 */
export const UpdatePersonalAttendanceSchema = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  tents: z.array(z.uuid()).default([]),
  amount: z.number().int().min(0).default(0),
});

export type UpdatePersonalAttendanceInput = z.infer<
  typeof UpdatePersonalAttendanceSchema
>;

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
 * Check-in from reservation path param
 * POST /api/v1/attendance/check-in/{reservationId}
 */
export const CheckInFromReservationParamSchema = z.object({
  reservationId: z.uuid({ error: "Invalid reservation ID" }),
});

export type CheckInFromReservationParam = z.infer<
  typeof CheckInFromReservationParamSchema
>;

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
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

export type GetAttendanceByDateQuery = z.infer<
  typeof GetAttendanceByDateQuerySchema
>;

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

export type GetAttendanceByDateResponse = z.infer<
  typeof GetAttendanceByDateResponseSchema
>;
