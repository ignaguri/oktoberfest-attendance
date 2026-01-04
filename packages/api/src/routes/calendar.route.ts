import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  GetPersonalCalendarQuerySchema,
  GetCalendarEventsResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";

import { SupabaseCalendarRepository } from "../repositories/supabase";

// Create router
const app = new OpenAPIHono<AuthContext>();

// GET /calendar/personal - Get personal calendar events
const getPersonalCalendarRoute = createRoute({
  method: "get",
  path: "/calendar/personal",
  tags: ["calendar"],
  summary: "Get personal calendar events",
  description:
    "Returns calendar events for the authenticated user including attendances, tent visits, and reservations",
  request: {
    query: GetPersonalCalendarQuerySchema,
  },
  responses: {
    200: {
      description: "Calendar events retrieved successfully",
      content: {
        "application/json": {
          schema: GetCalendarEventsResponseSchema,
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

app.openapi(getPersonalCalendarRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId } = c.req.valid("query");

  const calendarRepo = new SupabaseCalendarRepository(supabase);
  const result = await calendarRepo.getPersonalCalendarEvents(
    user.id,
    festivalId,
  );

  return c.json(
    {
      events: result.events,
      festivalId,
      festivalStartDate: result.festivalStartDate,
      festivalEndDate: result.festivalEndDate,
    },
    200,
  );
});

// GET /calendar/group/:groupId - Get group calendar events
const getGroupCalendarRoute = createRoute({
  method: "get",
  path: "/calendar/group/{groupId}",
  tags: ["calendar"],
  summary: "Get group calendar events",
  description:
    "Returns calendar events for all members of a group including attendances, tent visits, and reservations",
  request: {
    params: z.object({
      groupId: z.string().uuid({ message: "Invalid group ID" }),
    }),
  },
  responses: {
    200: {
      description: "Group calendar events retrieved successfully",
      content: {
        "application/json": {
          schema: GetCalendarEventsResponseSchema,
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
      description: "Group not found",
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

app.openapi(getGroupCalendarRoute, async (c) => {
  const { supabase } = c.var;
  const { groupId } = c.req.valid("param");

  const calendarRepo = new SupabaseCalendarRepository(supabase);
  const result = await calendarRepo.getGroupCalendarEvents(groupId);

  return c.json(
    {
      events: result.events,
      festivalId: result.festivalId,
      festivalStartDate: result.festivalStartDate,
      festivalEndDate: result.festivalEndDate,
    },
    200,
  );
});

export default app;
