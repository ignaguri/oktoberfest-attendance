import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  ConsumptionSchema,
  LogConsumptionResponseSchema,
  LogConsumptionSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";
import {
  SupabaseAttendanceRepository,
  SupabaseConsumptionRepository,
} from "../repositories/supabase";
import { ConsumptionService } from "../services/consumption.service";

// Query schema for listing consumptions
const ListConsumptionsQuerySchema = z.object({
  festivalId: z.string().uuid({ message: "Invalid festival ID" }),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

// Response schema for listing consumptions
const ListConsumptionsResponseSchema = z.object({
  consumptions: z.array(ConsumptionSchema),
});

// Path params for delete
const ConsumptionIdParamSchema = z.object({
  id: z.string().uuid({ message: "Invalid consumption ID" }),
});

// Response schema for delete
const DeleteConsumptionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// Create router
const app = new OpenAPIHono<AuthContext>();

// POST /consumption - Log a new consumption
const logConsumptionRoute = createRoute({
  method: "post",
  path: "/consumption",
  tags: ["consumption"],
  summary: "Log a new beer or drink consumption",
  description:
    "Records a consumption and updates the attendance record with computed totals",
  request: {
    body: {
      content: {
        "application/json": {
          schema: LogConsumptionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Consumption logged successfully",
      content: {
        "application/json": {
          schema: LogConsumptionResponseSchema,
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

app.openapi(logConsumptionRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const data = c.req.valid("json");

  // Initialize repositories and service
  const consumptionRepo = new SupabaseConsumptionRepository(supabase);
  const attendanceRepo = new SupabaseAttendanceRepository(supabase);
  const service = new ConsumptionService(consumptionRepo, attendanceRepo);

  // Log consumption
  const attendance = await service.logConsumption(user.id, data);

  return c.json(attendance, 200);
});

// GET /consumption - List consumptions for a date
const listConsumptionsRoute = createRoute({
  method: "get",
  path: "/consumption",
  tags: ["consumption"],
  summary: "List consumptions for a date",
  description:
    "Get all consumptions for the authenticated user on a specific date",
  request: {
    query: ListConsumptionsQuerySchema,
  },
  responses: {
    200: {
      description: "Consumptions retrieved successfully",
      content: {
        "application/json": {
          schema: ListConsumptionsResponseSchema,
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

app.openapi(listConsumptionsRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { festivalId, date } = c.req.valid("query");

  const consumptionRepo = new SupabaseConsumptionRepository(supabase);
  const consumptions = await consumptionRepo.findByFestivalAndDate(
    user.id,
    festivalId,
    date,
  );

  return c.json({ consumptions }, 200);
});

// DELETE /consumption/:id - Delete a consumption
const deleteConsumptionRoute = createRoute({
  method: "delete",
  path: "/consumption/{id}",
  tags: ["consumption"],
  summary: "Delete a consumption",
  description: "Delete a consumption record by ID",
  request: {
    params: ConsumptionIdParamSchema,
  },
  responses: {
    200: {
      description: "Consumption deleted successfully",
      content: {
        "application/json": {
          schema: DeleteConsumptionResponseSchema,
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
    404: {
      description: "Consumption not found",
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

app.openapi(deleteConsumptionRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");

  const consumptionRepo = new SupabaseConsumptionRepository(supabase);
  await consumptionRepo.delete(id, user.id);

  return c.json(
    { success: true, message: "Consumption deleted successfully" },
    200,
  );
});

export default app;
