import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  ListAttendancesQuerySchema,
  ListAttendancesResponseSchema,
  AttendanceIdParamSchema,
  DeleteAttendanceResponseSchema,
} from "@prostcounter/shared";
import { SupabaseAttendanceRepository } from "../repositories/supabase";
import type { AuthContext } from "../middleware/auth";
import { NotFoundError } from "../middleware/error";

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
    200
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
    200
  );
});

export default app;
