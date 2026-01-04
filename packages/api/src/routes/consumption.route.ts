import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  LogConsumptionSchema,
  LogConsumptionResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";

import {
  SupabaseConsumptionRepository,
  SupabaseAttendanceRepository,
} from "../repositories/supabase";
import { ConsumptionService } from "../services/consumption.service";

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

export default app;
