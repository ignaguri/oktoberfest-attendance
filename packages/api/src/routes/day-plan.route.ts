import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  DayPlanFestivalParamSchema,
  DayPlanPathParamsSchema,
  DayPlanResponseSchema,
  DeleteDayPlanResponseSchema,
  GetCompanionOptionsResponseSchema,
  GetFriendsGoingResponseSchema,
  ListDayPlansResponseSchema,
  UpsertDayPlanSchema,
} from "@prostcounter/shared";

import { logger } from "../lib/logger";
import type { AuthContext } from "../middleware/auth";
import { SupabaseDayPlanRepository } from "../repositories/supabase";
import { DayPlanService } from "../services/day-plan.service";
import { createNotificationService } from "../services/notification.service";
import { ApiErrorSchema } from "../lib/error-response";

const app = new OpenAPIHono<AuthContext>();

const ErrorResponseSchema = ApiErrorSchema;

function errorResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: ErrorResponseSchema } },
  };
}

// GET /festivals/:festivalId/plans - The user's plans and reservations
const listDayPlansRoute = createRoute({
  method: "get",
  path: "/festivals/{festivalId}/plans",
  tags: ["day-plans"],
  summary: "List the user's day plans",
  description:
    "Returns the user's active mark (plan to go or reservation) for every day of the festival that has one.",
  request: {
    params: DayPlanFestivalParamSchema,
  },
  responses: {
    200: {
      description: "Day plans retrieved successfully",
      content: { "application/json": { schema: ListDayPlansResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listDayPlansRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId } = c.req.valid("param");

  const service = new DayPlanService(new SupabaseDayPlanRepository(supabase));
  const plans = await service.listPlans(user.id, festivalId);

  return c.json({ plans }, 200);
});

// PUT /festivals/:festivalId/days/:date/plan - Plan to go, or reserve, on a day
const upsertDayPlanRoute = createRoute({
  method: "put",
  path: "/festivals/{festivalId}/days/{date}/plan",
  tags: ["day-plans"],
  summary: "Set the user's plan for a day",
  description:
    "Creates or replaces the day's single mark. Switching between plan and reservation updates the same row.",
  request: {
    params: DayPlanPathParamsSchema,
    body: {
      content: { "application/json": { schema: UpsertDayPlanSchema } },
    },
  },
  responses: {
    200: {
      description: "Day plan saved",
      content: { "application/json": { schema: DayPlanResponseSchema } },
    },
    400: errorResponse("Validation error"),
    401: errorResponse("Unauthorized"),
    404: errorResponse("Festival not found"),
    409: errorResponse("The day's reservation can no longer be changed"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(upsertDayPlanRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId, date } = c.req.valid("param");
  const input = c.req.valid("json");

  const service = new DayPlanService(new SupabaseDayPlanRepository(supabase));
  const result = await service.upsertPlan(user.id, festivalId, date, input);

  const notificationService = result.becameVisible ? createNotificationService(supabase) : null;
  if (notificationService) {
    // Never fail the save over a notification.
    try {
      await notificationService.notifyPlanOverlap({
        actorId: user.id,
        festivalId,
        date,
        today: result.today,
        kind: result.plan.kind,
        tentName: result.plan.tentName,
      });
    } catch (notificationError) {
      logger.error({ error: notificationError }, "Failed to send plan overlap notification");
    }
  }

  return c.json({ plan: result.plan }, 200);
});

// DELETE /festivals/:festivalId/days/:date/plan - Not going
const deleteDayPlanRoute = createRoute({
  method: "delete",
  path: "/festivals/{festivalId}/days/{date}/plan",
  tags: ["day-plans"],
  summary: "Clear the user's plan for a day",
  description: "Deletes a plan, or cancels a reservation.",
  request: {
    params: DayPlanPathParamsSchema,
  },
  responses: {
    200: {
      description: "Day plan cleared",
      content: { "application/json": { schema: DeleteDayPlanResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
    404: errorResponse("The day has no plan"),
    409: errorResponse("The day's reservation already happened and can't be cancelled"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(deleteDayPlanRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId, date } = c.req.valid("param");

  const service = new DayPlanService(new SupabaseDayPlanRepository(supabase));
  await service.removePlan(user.id, festivalId, date);

  return c.json({ success: true }, 200);
});

// GET /festivals/:festivalId/friends-going - Friends' visible plans from today on
const friendsGoingRoute = createRoute({
  method: "get",
  path: "/festivals/{festivalId}/friends-going",
  tags: ["day-plans"],
  summary: "List friends going on upcoming days",
  description:
    "Friends' and group-mates' visible plans and reservations from today on, grouped by day.",
  request: {
    params: DayPlanFestivalParamSchema,
  },
  responses: {
    200: {
      description: "Friends going retrieved successfully",
      content: { "application/json": { schema: GetFriendsGoingResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
    404: errorResponse("Festival not found"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(friendsGoingRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId } = c.req.valid("param");

  const service = new DayPlanService(new SupabaseDayPlanRepository(supabase));
  const days = await service.getFriendsGoing(user.id, festivalId);

  return c.json({ days }, 200);
});

// GET /festivals/:festivalId/plan-companions - Who the user can tag on a plan
const companionOptionsRoute = createRoute({
  method: "get",
  path: "/festivals/{festivalId}/plan-companions",
  tags: ["day-plans"],
  summary: "List who can be tagged on a plan",
  description:
    "Friends and group-mates for the festival, and the user's groups in it: everyone a plan can say the user is going with.",
  request: {
    params: DayPlanFestivalParamSchema,
  },
  responses: {
    200: {
      description: "Companion options retrieved successfully",
      content: { "application/json": { schema: GetCompanionOptionsResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
    404: errorResponse("Festival not found"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(companionOptionsRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId } = c.req.valid("param");

  const service = new DayPlanService(new SupabaseDayPlanRepository(supabase));
  const options = await service.getCompanionOptions(user.id, festivalId);

  return c.json(options, 200);
});

export default app;
