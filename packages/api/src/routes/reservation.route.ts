import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  CreateReservationSchema,
  CreateReservationResponseSchema,
  CheckinReservationResponseSchema,
  GetReservationsQuerySchema,
  GetReservationsResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";

import { SupabaseReservationRepository } from "../repositories/supabase";
import { ReservationService } from "../services/reservation.service";

// Create router
const app = new OpenAPIHono<AuthContext>();

// POST /reservations - Create reservation
const createReservationRoute = createRoute({
  method: "post",
  path: "/reservations",
  tags: ["reservations"],
  summary: "Create a tent reservation",
  description:
    "Creates a new reservation for a specific tent and time. Optionally schedule reminders.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateReservationSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Reservation created successfully",
      content: {
        "application/json": {
          schema: CreateReservationResponseSchema,
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

app.openapi(createReservationRoute, async (c) => {
  const { user, supabase } = c.var;
  const data = c.req.valid("json");

  const reservationRepo = new SupabaseReservationRepository(supabase);
  const reservationService = new ReservationService(reservationRepo);

  const reservation = await reservationService.createReservation(user.id, data);

  return c.json({ reservation }, 200);
});

// POST /reservations/:id/checkin - Check in to reservation
const checkinReservationRoute = createRoute({
  method: "post",
  path: "/reservations/{id}/checkin",
  tags: ["reservations"],
  summary: "Check in to a reservation",
  description:
    "Marks a reservation as checked in. Optionally creates an attendance record if auto_checkin is enabled.",
  request: {
    params: z.object({
      id: z.string().uuid("Invalid reservation ID"),
    }),
  },
  responses: {
    200: {
      description: "Checked in successfully",
      content: {
        "application/json": {
          schema: CheckinReservationResponseSchema,
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
      description: "Reservation not found",
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

app.openapi(checkinReservationRoute, async (c) => {
  const { user, supabase } = c.var;
  const { id } = c.req.valid("param");

  const reservationRepo = new SupabaseReservationRepository(supabase);
  const reservationService = new ReservationService(reservationRepo);

  const result = await reservationService.checkin(id, user.id);

  return c.json(result, 200);
});

// GET /reservations - List user reservations
const listReservationsRoute = createRoute({
  method: "get",
  path: "/reservations",
  tags: ["reservations"],
  summary: "List user reservations",
  description:
    "Retrieves all reservations for the authenticated user with optional filters",
  request: {
    query: GetReservationsQuerySchema,
  },
  responses: {
    200: {
      description: "Reservations retrieved successfully",
      content: {
        "application/json": {
          schema: GetReservationsResponseSchema,
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

app.openapi(listReservationsRoute, async (c) => {
  const { user, supabase } = c.var;
  const query = c.req.valid("query");

  const reservationRepo = new SupabaseReservationRepository(supabase);
  const reservationService = new ReservationService(reservationRepo);

  const result = await reservationService.listReservations(
    user.id,
    query.festivalId,
    query.status,
    query.upcoming,
    query.limit,
    query.offset,
  );

  return c.json(
    {
      reservations: result.data,
      total: result.total,
      limit: query.limit || 50,
      offset: query.offset || 0,
    },
    200,
  );
});

// DELETE /reservations/:id - Cancel reservation
const cancelReservationRoute = createRoute({
  method: "delete",
  path: "/reservations/{id}",
  tags: ["reservations"],
  summary: "Cancel a reservation",
  description: "Cancels an existing reservation",
  request: {
    params: z.object({
      id: z.string().uuid("Invalid reservation ID"),
    }),
  },
  responses: {
    200: {
      description: "Reservation cancelled successfully",
      content: {
        "application/json": {
          schema: CreateReservationResponseSchema,
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
      description: "Reservation not found",
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

app.openapi(cancelReservationRoute, async (c) => {
  const { user, supabase } = c.var;
  const { id } = c.req.valid("param");

  const reservationRepo = new SupabaseReservationRepository(supabase);
  const reservationService = new ReservationService(reservationRepo);

  const reservation = await reservationService.cancelReservation(id, user.id);

  return c.json({ reservation }, 200);
});

export default app;
