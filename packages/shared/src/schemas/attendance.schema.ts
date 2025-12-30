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
