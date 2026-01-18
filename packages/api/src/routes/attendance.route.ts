import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  AttendanceIdParamSchema,
  CheckInFromReservationParamSchema,
  CheckInFromReservationResponseSchema,
  CreateAttendanceResponseSchema,
  CreateAttendanceSchema,
  DeleteAttendanceResponseSchema,
  GetAttendanceByDateQuerySchema,
  GetAttendanceByDateResponseSchema,
  ListAttendancesQuerySchema,
  ListAttendancesResponseSchema,
  UpdatePersonalAttendanceResponseSchema,
  UpdatePersonalAttendanceSchema,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";

import type { AuthContext } from "../middleware/auth";
import { NotFoundError, ValidationError } from "../middleware/error";
import {
  SupabaseAttendanceRepository,
  SupabasePhotoRepository,
} from "../repositories/supabase";
import { NotificationService } from "../services/notification.service";

// Create router
const app = new OpenAPIHono<AuthContext>();

// GET /attendance - List user's attendances
const listAttendancesRoute = createRoute({
  method: "get",
  path: "/attendance",
  tags: ["attendance"],
  summary: "List user's attendance records",
  description:
    "Returns paginated list of attendance records with computed totals",
  request: {
    query: ListAttendancesQuerySchema,
  },
  responses: {
    200: {
      description: "Attendances retrieved successfully",
      content: {
        "application/json": {
          schema: ListAttendancesResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listAttendancesRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const query = c.req.valid("query");

  const attendanceRepo = new SupabaseAttendanceRepository(supabase);
  const result = await attendanceRepo.list(user.id, query);

  return c.json(
    {
      data: result.data,
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    },
    200,
  );
});

// GET /attendance/by-date - Get attendance for a specific date with pictures
const getAttendanceByDateRoute = createRoute({
  method: "get",
  path: "/attendance/by-date",
  tags: ["attendance"],
  summary: "Get attendance for a specific date",
  description:
    "Returns attendance record for a specific date with tent IDs and picture URLs",
  request: {
    query: GetAttendanceByDateQuerySchema,
  },
  responses: {
    200: {
      description: "Attendance retrieved successfully",
      content: {
        "application/json": {
          schema: GetAttendanceByDateResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getAttendanceByDateRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const query = c.req.valid("query");

  const attendanceRepo = new SupabaseAttendanceRepository(supabase);
  const result = await attendanceRepo.getByDate(
    user.id,
    query.festivalId,
    query.date,
  );

  return c.json({ attendance: result }, 200);
});

// DELETE /attendance/:id - Delete an attendance
const deleteAttendanceRoute = createRoute({
  method: "delete",
  path: "/attendance/{id}",
  tags: ["attendance"],
  summary: "Delete an attendance record",
  description:
    "Deletes an attendance and all its associated consumptions (cascading delete)",
  request: {
    params: AttendanceIdParamSchema,
  },
  responses: {
    200: {
      description: "Attendance deleted successfully",
      content: {
        "application/json": {
          schema: DeleteAttendanceResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    404: {
      description: "Attendance not found",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(deleteAttendanceRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");

  // Verify attendance exists first
  const attendanceRepo = new SupabaseAttendanceRepository(supabase);
  const attendance = await attendanceRepo.findById(id);

  if (!attendance) {
    throw new NotFoundError(ErrorCodes.ATTENDANCE_NOT_FOUND);
  }

  // Delete associated photos first (to avoid FK constraint)
  const photoRepo = new SupabasePhotoRepository(supabase);
  await photoRepo.deleteByAttendanceId(id, user.id);

  // Delete the attendance
  await attendanceRepo.delete(id, user.id);

  return c.json(
    {
      success: true,
      message: "Attendance deleted successfully",
    },
    200,
  );
});

// POST /attendance - Create/update attendance with tents
const createAttendanceRoute = createRoute({
  method: "post",
  path: "/attendance",
  tags: ["attendance"],
  summary: "Create or update attendance with tents",
  description:
    "Creates or updates an attendance record with tent visits. Triggers tent check-in notifications for group members.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateAttendanceSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Attendance created/updated successfully",
      content: {
        "application/json": {
          schema: CreateAttendanceResponseSchema,
        },
      },
    },
    400: {
      description: "Validation error - Invalid festival ID",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(createAttendanceRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const data = c.req.valid("json");

  const attendanceRepo = new SupabaseAttendanceRepository(supabase);

  // Validate festival exists
  const festival = await attendanceRepo.festivalExists(data.festivalId);
  if (!festival) {
    throw new ValidationError(ErrorCodes.FESTIVAL_NOT_FOUND);
  }

  // Create/update attendance with tents
  const result = await attendanceRepo.createWithTents(user.id, data);

  // Trigger tent check-in notifications only if tents were actually changed
  if (data.tents && data.tents.length > 0 && result.tentsChanged) {
    const novuApiKey = process.env.NOVU_API_KEY;
    if (novuApiKey) {
      try {
        // Get user's group memberships for this festival
        const { data: groupMemberships, error: groupError } = await supabase
          .from("group_members")
          .select(
            `
            group_id,
            groups!inner(festival_id)
          `,
          )
          .eq("user_id", user.id)
          .eq("groups.festival_id", data.festivalId);

        if (!groupError && groupMemberships && groupMemberships.length > 0) {
          // Get tent names for better notifications
          const { data: tentData } = await supabase
            .from("tents")
            .select("id, name")
            .in("id", data.tents);

          const tentNames =
            tentData
              ?.map((tent) => tent.name)
              .filter((name) => name)
              .join(", ") || "Multiple tents";
          const groupIds = groupMemberships
            .map((membership) => membership.group_id)
            .filter((id): id is string => id !== null);

          const notificationService = new NotificationService(
            supabase,
            novuApiKey,
          );
          await notificationService.notifyTentCheckin(
            user.id,
            tentNames,
            groupIds,
            data.festivalId,
          );
        }
      } catch (notificationError) {
        // Don't fail the attendance operation if notification fails
        console.error(
          "Failed to send tent check-in notification:",
          notificationError,
        );
      }
    }
  }

  return c.json(result, 200);
});

// POST /attendance/personal - Update personal attendance (no notifications)
const updatePersonalAttendanceRoute = createRoute({
  method: "post",
  path: "/attendance/personal",
  tags: ["attendance"],
  summary: "Update personal attendance",
  description:
    "Updates personal attendance without triggering group notifications. Preserves existing tent visit timestamps.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdatePersonalAttendanceSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Attendance updated successfully",
      content: {
        "application/json": {
          schema: UpdatePersonalAttendanceResponseSchema,
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updatePersonalAttendanceRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const data = c.req.valid("json");

  const attendanceRepo = new SupabaseAttendanceRepository(supabase);

  // Validate festival exists
  const festival = await attendanceRepo.festivalExists(data.festivalId);
  if (!festival) {
    throw new ValidationError(ErrorCodes.FESTIVAL_NOT_FOUND);
  }

  // Update personal attendance
  const result = await attendanceRepo.updatePersonal(user.id, data);

  return c.json(result, 200);
});

// POST /attendance/check-in/:reservationId - Check in from reservation
const checkInFromReservationRoute = createRoute({
  method: "post",
  path: "/attendance/check-in/{reservationId}",
  tags: ["attendance"],
  summary: "Check in from a reservation",
  description:
    "Creates an attendance record from a scheduled reservation, adds tent visit, and marks the reservation as completed.",
  request: {
    params: CheckInFromReservationParamSchema,
  },
  responses: {
    200: {
      description: "Check-in successful",
      content: {
        "application/json": {
          schema: CheckInFromReservationResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    404: {
      description: "Reservation not found or already processed",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(checkInFromReservationRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { reservationId } = c.req.valid("param");

  // Get the reservation details
  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select(
      `
      id,
      festival_id,
      tent_id,
      start_at,
      tents(name)
    `,
    )
    .eq("id", reservationId)
    .eq("user_id", user.id)
    .in("status", ["pending", "confirmed"])
    .single();

  if (reservationError || !reservation) {
    throw new NotFoundError(ErrorCodes.RESERVATION_NOT_FOUND);
  }

  // Get festival timezone
  const { data: festival, error: festivalError } = await supabase
    .from("festivals")
    .select("timezone")
    .eq("id", reservation.festival_id)
    .single();

  if (festivalError || !festival) {
    throw new NotFoundError(ErrorCodes.FESTIVAL_NOT_FOUND);
  }

  // Convert start_at to festival timezone date (YYYY-MM-DD)
  const startDate = new Date(reservation.start_at);
  const festivalDate = startDate.toISOString().split("T")[0];

  // Check if user already has attendance for this date
  const { data: existingAttendance, error: attendanceError } = await supabase
    .from("attendances")
    .select("id")
    .eq("user_id", user.id)
    .eq("festival_id", reservation.festival_id)
    .eq("date", festivalDate)
    .single();

  let attendanceId = existingAttendance?.id;

  if (attendanceError && attendanceError.code !== "PGRST116") {
    throw new Error("Error checking existing attendance");
  }

  // If no existing attendance, create one
  if (!existingAttendance) {
    const { data: newAttendance, error: insertError } = await supabase
      .from("attendances")
      .insert({
        user_id: user.id,
        festival_id: reservation.festival_id,
        date: festivalDate,
        beer_count: 0,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error("Error creating attendance");
    }

    attendanceId = newAttendance?.id;
  }

  // Add tent visit if not already present
  const { error: tentVisitError } = await supabase
    .from("tent_visits")
    .insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      festival_id: reservation.festival_id,
      tent_id: reservation.tent_id,
      visit_date: startDate.toISOString(),
    })
    .select()
    .single();

  // Ignore unique constraint violation (tent visit already exists)
  if (tentVisitError && tentVisitError.code !== "23505") {
    throw new Error("Error creating tent visit");
  }

  // Mark reservation as completed
  const { error: updateError } = await supabase
    .from("reservations")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error("Error updating reservation status");
  }

  return c.json(
    {
      success: true,
      message: "Check-in successful",
      attendanceId,
    },
    200,
  );
});

export default app;
