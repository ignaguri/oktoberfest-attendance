import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  ListAttendancesQuerySchema,
  ListAttendancesResponseSchema,
  AttendanceIdParamSchema,
  DeleteAttendanceResponseSchema,
  CreateAttendanceSchema,
  CreateAttendanceResponseSchema,
  UpdatePersonalAttendanceSchema,
  UpdatePersonalAttendanceResponseSchema,
  CheckInFromReservationParamSchema,
  CheckInFromReservationResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";

import { NotFoundError, ValidationError } from "../middleware/error";
import { SupabaseAttendanceRepository } from "../repositories/supabase";

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
    throw new NotFoundError("Attendance not found");
  }

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
    throw new ValidationError(
      `Invalid festival ID: ${data.festivalId}. Please refresh the page and try again.`,
    );
  }

  // Create/update attendance with tents
  const result = await attendanceRepo.createWithTents(user.id, data);

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
    throw new ValidationError(
      `Invalid festival ID: ${data.festivalId}. Please refresh the page and try again.`,
    );
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
    .eq("status", "scheduled")
    .single();

  if (reservationError || !reservation) {
    throw new NotFoundError("Reservation not found or already processed");
  }

  // Get festival timezone
  const { data: festival, error: festivalError } = await supabase
    .from("festivals")
    .select("timezone")
    .eq("id", reservation.festival_id)
    .single();

  if (festivalError || !festival) {
    throw new NotFoundError("Festival not found");
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
