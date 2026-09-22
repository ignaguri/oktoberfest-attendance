import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { SupabaseClient } from "@supabase/supabase-js";
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
  LogTentVisitResponseSchema,
  LogTentVisitSchema,
  UpdatePersonalAttendanceResponseSchema,
  UpdatePersonalAttendanceSchema,
} from "@prostcounter/shared";
import { ErrorCodes } from "@prostcounter/shared/errors";
import { formatDateForDatabase } from "@prostcounter/shared/utils";
import type { Database } from "@prostcounter/db";

import { logger } from "../lib/logger";
import { PgErrorCode } from "../lib/postgres-errors";
import type { AuthContext } from "../middleware/auth";
import { DatabaseError, NotFoundError, ValidationError } from "../middleware/error";
import {
  SupabaseAttendanceRepository,
  SupabasePhotoRepository,
  SupabaseWrappedRepository,
} from "../repositories/supabase";
import { evaluateAfterWrite } from "../services/evaluate-after-write";
import { NotificationService } from "../services/notification.service";
import { ApiErrorSchema } from "../lib/error-response";

/**
 * One push per check-in.
 *
 * The ledger claim inside notifyDayStart decides which: winning it means this
 * is the day's first action, so friends and group-mates get a day-start;
 * losing it means the day is already underway, so group-mates get the ordinary
 * tent check-in. Never both.
 *
 * Never throws — a notification failure must not fail the attendance write.
 */
async function announceCheckIn(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    festivalId: string;
    date: string;
    tentNames: string;
    groupIds: string[];
  },
): Promise<void> {
  const novuApiKey = process.env.NOVU_API_KEY;
  if (!novuApiKey) {
    return;
  }

  try {
    const notificationService = new NotificationService(supabase, novuApiKey);

    const startedDay = await notificationService.notifyDayStart({
      actorId: input.userId,
      festivalId: input.festivalId,
      date: input.date,
      kind: "checkin",
      tentName: input.tentNames || null,
    });

    if (startedDay) {
      return;
    }

    if (input.groupIds.length > 0) {
      await notificationService.notifyTentCheckin(
        input.userId,
        input.tentNames,
        input.groupIds,
        input.festivalId,
      );
    }
  } catch (notificationError) {
    logger.error({ error: notificationError }, "Failed to send check-in notification");
  }
}

/** The caller's group ids for a festival. Empty on any failure. */
async function groupIdsForFestival(
  supabase: SupabaseClient<Database>,
  userId: string,
  festivalId: string,
): Promise<string[]> {
  const { data: memberships, error } = await supabase
    .from("group_members")
    .select("group_id, groups!inner(festival_id)")
    .eq("user_id", userId)
    .eq("groups.festival_id", festivalId);

  if (error || !memberships) {
    return [];
  }

  return memberships
    .map((membership) => membership.group_id)
    .filter((id): id is string => id !== null);
}

/** Tent names for ids, comma-joined. Falls back to a generic label. */
async function tentNamesFor(
  supabase: SupabaseClient<Database>,
  tentIds: string[],
): Promise<string> {
  if (tentIds.length === 0) {
    return "a tent";
  }

  const { data: tents } = await supabase.from("tents").select("id, name").in("id", tentIds);

  return (
    tents
      ?.map((tent) => tent.name)
      .filter((name) => name)
      .join(", ") || "a tent"
  );
}

// Create router
const app = new OpenAPIHono<AuthContext>();

// GET /attendance - List user's attendances
const listAttendancesRoute = createRoute({
  method: "get",
  path: "/attendance",
  tags: ["attendance"],
  summary: "List user's attendance records",
  description: "Returns paginated list of attendance records with computed totals",
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
          schema: ApiErrorSchema,
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
      ...(result.tentVisits !== undefined && {
        tentVisits: result.tentVisits,
      }),
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
  description: "Returns attendance record for a specific date with tent IDs and picture URLs",
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
          schema: ApiErrorSchema,
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
  const result = await attendanceRepo.getByDate(user.id, query.festivalId, query.date);

  return c.json({ attendance: result }, 200);
});

// DELETE /attendance/:id - Delete an attendance
const deleteAttendanceRoute = createRoute({
  method: "delete",
  path: "/attendance/{id}",
  tags: ["attendance"],
  summary: "Delete an attendance record",
  description: "Deletes an attendance and all its associated consumptions (cascading delete)",
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
          schema: ApiErrorSchema,
        },
      },
    },
    404: {
      description: "Attendance not found",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
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

  // Query the attendances table directly (not the view) to avoid
  // security_invoker RLS complexity on attendance_with_totals
  const { data: attendance, error: findError } = await supabase
    .from("attendances")
    .select("id, user_id, festival_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (findError && findError.code !== PgErrorCode.NO_ROWS) {
    throw new DatabaseError(`Failed to fetch attendance: ${findError.message}`);
  }

  if (!attendance) {
    // Already deleted or doesn't belong to user - treat as idempotent success
    return c.json(
      {
        success: true,
        message: "Attendance deleted successfully",
      },
      200,
    );
  }

  // Delete associated photos first (to avoid FK constraint)
  const photoRepo = new SupabasePhotoRepository(supabase);
  await photoRepo.deleteByAttendanceId(id, user.id);

  // Delete the attendance
  const attendanceRepo = new SupabaseAttendanceRepository(supabase);
  await attendanceRepo.delete(id, user.id);

  // Invalidate wrapped data cache (attendance changes affect wrapped stats)
  try {
    const wrappedRepo = new SupabaseWrappedRepository(supabase);
    await wrappedRepo.invalidateCache(user.id, attendance.festival_id);
  } catch (cacheError) {
    logger.error(
      { error: cacheError },
      "Failed to invalidate wrapped cache after attendance delete",
    );
  }

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
          schema: ApiErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
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

  // Invalidate wrapped data cache (attendance changes affect wrapped stats)
  try {
    const wrappedRepo = new SupabaseWrappedRepository(supabase);
    await wrappedRepo.invalidateCache(user.id, data.festivalId);
  } catch (cacheError) {
    logger.error(
      { error: cacheError },
      "Failed to invalidate wrapped cache after attendance create",
    );
  }

  // Trigger check-in notifications only if tents were actually changed
  if (data.tents && data.tents.length > 0 && result.tentsChanged) {
    const groupIds = await groupIdsForFestival(supabase, user.id, data.festivalId);
    const tentNames = await tentNamesFor(supabase, data.tents);

    await announceCheckIn(supabase, {
      userId: user.id,
      festivalId: data.festivalId,
      date: data.date,
      tentNames,
      groupIds,
    });
  }

  const unlocked = await evaluateAfterWrite(supabase, user.id, data.festivalId, "POST /attendance");

  return c.json({ ...result, unlocked }, 200);
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
          schema: ApiErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
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

  if (data.tents && data.tents.length > 0) {
    const groupIds = await groupIdsForFestival(supabase, user.id, data.festivalId);
    const tentNames = await tentNamesFor(supabase, data.tents);

    await announceCheckIn(supabase, {
      userId: user.id,
      festivalId: data.festivalId,
      date: data.date,
      tentNames,
      groupIds,
    });
  }

  // Invalidate wrapped data cache (attendance changes affect wrapped stats)
  try {
    const wrappedRepo = new SupabaseWrappedRepository(supabase);
    await wrappedRepo.invalidateCache(user.id, data.festivalId);
  } catch (cacheError) {
    logger.error(
      { error: cacheError },
      "Failed to invalidate wrapped cache after personal attendance update",
    );
  }

  const unlocked = await evaluateAfterWrite(
    supabase,
    user.id,
    data.festivalId,
    "POST /attendance/personal",
  );

  return c.json({ ...result, unlocked }, 200);
});

// POST /attendance/tent-visits - Log one more visit to a tent
const logTentVisitRoute = createRoute({
  method: "post",
  path: "/attendance/tent-visits",
  tags: ["attendance"],
  summary: "Log a tent visit",
  description:
    "Appends a timestamped visit to a tent, creating the day's attendance if needed. Use this to record returning to a tent later the same day; POST /attendance/personal reconciles the day's set of tents and cannot express a second visit.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: LogTentVisitSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Tent visit logged",
      content: {
        "application/json": {
          schema: LogTentVisitResponseSchema,
        },
      },
    },
    400: {
      description: "Validation error, or the tent is already the day's latest visit",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(logTentVisitRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const data = c.req.valid("json");

  const attendanceRepo = new SupabaseAttendanceRepository(supabase);

  const festival = await attendanceRepo.festivalExists(data.festivalId);
  if (!festival) {
    throw new ValidationError(ErrorCodes.FESTIVAL_NOT_FOUND);
  }

  const result = await attendanceRepo.logTentVisit(user.id, data);

  // visit_date as the repository stored it, already bucketed into the
  // festival's timezone. Never re-derive it from the incoming timestamp.
  const visitDate = result.visitDate;

  if (visitDate) {
    const groupIds = await groupIdsForFestival(supabase, user.id, data.festivalId);
    const tentNames = await tentNamesFor(supabase, [data.tentId]);

    await announceCheckIn(supabase, {
      userId: user.id,
      festivalId: data.festivalId,
      date: visitDate,
      tentNames,
      groupIds,
    });
  }

  try {
    const wrappedRepo = new SupabaseWrappedRepository(supabase);
    await wrappedRepo.invalidateCache(user.id, data.festivalId);
  } catch (cacheError) {
    logger.error({ error: cacheError }, "Failed to invalidate wrapped cache after tent visit");
  }

  return c.json(result, 201);
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
          schema: ApiErrorSchema,
        },
      },
    },
    404: {
      description: "Reservation not found or already processed",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
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
    .from("day_plans")
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
    .eq("kind", "reservation")
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

  // Convert start_at to festival timezone date (YYYY-MM-DD). The timezone was
  // already being fetched above and then discarded in favour of toISOString(),
  // which is UTC: a reservation starting just after local midnight was filed
  // under the previous day.
  const startDate = new Date(reservation.start_at);
  const festivalDate = formatDateForDatabase(startDate, festival.timezone);

  // Check if user already has attendance for this date
  const { data: existingAttendance, error: attendanceError } = await supabase
    .from("attendances")
    .select("id")
    .eq("user_id", user.id)
    .eq("festival_id", reservation.festival_id)
    .eq("date", festivalDate)
    .single();

  let attendanceId = existingAttendance?.id;

  if (attendanceError && attendanceError.code !== PgErrorCode.NO_ROWS) {
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
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error("Error creating attendance");
    }

    attendanceId = newAttendance?.id;
  }

  // Record the check-in as one more visit in the day's sequence.
  //
  // This used to skip the insert whenever the tent had any visit that day,
  // which contradicts the whole point of same-day revisits: walking Hofbräu ->
  // Paulaner -> back to Hofbräu for a 19:00 reservation dropped the third visit
  // and left the day reading as if the user never returned. The rule it was
  // enforcing - one visit per tent per day - was justified by the mobile pull
  // deleting whichever row shared that natural key with a different id, and the
  // pull stopped doing that when revisits landed (see
  // sync/pull-user-data.ts processTentVisits).
  //
  // Delegating to the repository also means one implementation of "is this
  // actually a move", instead of a second copy of the day-window arithmetic
  // that had drifted to a different rule. Its own attendance upsert is
  // idempotent, so it costs a redundant touch and keeps attendanceId defined
  // above even when the visit turns out to be a no-op.
  const attendanceRepo = new SupabaseAttendanceRepository(supabase);
  try {
    await attendanceRepo.logTentVisit(user.id, {
      festivalId: reservation.festival_id,
      tentId: reservation.tent_id,
      visitedAt: startDate.toISOString(),
    });
  } catch (error) {
    // Already the day's current tent, so the check-in adds nothing: the user is
    // confirming a tent they are recorded as being in. Not a failed check-in.
    if (
      !(error instanceof ValidationError) ||
      error.code !== ErrorCodes.TENT_ALREADY_CURRENT_VISIT
    ) {
      throw error;
    }
  }

  // Mark reservation as completed
  const { error: updateError } = await supabase
    .from("day_plans")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .eq("user_id", user.id);

  if (updateError) {
    throw new Error("Error updating reservation status");
  }

  // Invalidate wrapped data cache (check-in affects wrapped stats)
  try {
    const wrappedRepo = new SupabaseWrappedRepository(supabase);
    await wrappedRepo.invalidateCache(user.id, reservation.festival_id);
  } catch (cacheError) {
    logger.error(
      { error: cacheError },
      "Failed to invalidate wrapped cache after reservation check-in",
    );
  }

  const unlocked = await evaluateAfterWrite(
    supabase,
    user.id,
    reservation.festival_id,
    "POST /attendance/check-in",
  );

  return c.json(
    {
      success: true,
      message: "Check-in successful",
      attendanceId,
      unlocked,
    },
    200,
  );
});

export default app;
