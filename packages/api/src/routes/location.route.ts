import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  GetNearbyMembersQuerySchema,
  GetNearbyMembersResponseSchema,
  StartLocationSessionResponseSchema,
  StartLocationSessionSchema,
  StopLocationSessionResponseSchema,
  UpdateLocationSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";
import { SupabaseLocationRepository } from "../repositories/supabase";
import { LocationService } from "../services/location.service";
import { NotificationService } from "../services/notification.service";

// Create router
const app = new OpenAPIHono<AuthContext>();

// POST /location/sessions - Start location sharing session
const startSessionRoute = createRoute({
  method: "post",
  path: "/location/sessions",
  tags: ["location"],
  summary: "Start location sharing session",
  description:
    "Creates a new location sharing session for a festival. User can only have one active session per festival.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: StartLocationSessionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Session started successfully",
      content: {
        "application/json": {
          schema: StartLocationSessionResponseSchema,
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
    409: {
      description:
        "Conflict - User already has active session for this festival",
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

app.openapi(startSessionRoute, async (c) => {
  const { user, supabase } = c.var;
  const data = c.req.valid("json");

  const locationRepo = new SupabaseLocationRepository(supabase);
  const locationService = new LocationService(locationRepo);

  const session = await locationService.startSession(user.id, data);

  // Notify group members about location sharing (fire and forget)
  const novuApiKey = process.env.NOVU_API_KEY;
  if (novuApiKey) {
    const notificationService = new NotificationService(supabase, novuApiKey);
    // Pass groupIds if specific visibility was selected
    const groupIds = data.visibility === "specific" ? data.groupIds : undefined;
    notificationService
      .notifyLocationSharingStarted(user.id, data.festivalId, groupIds)
      .catch(() => {
        // Silently ignore notification errors - don't fail the session start
      });
  }

  return c.json({ session }, 200);
});

// DELETE /location/sessions/:id - Stop location sharing session
const stopSessionRoute = createRoute({
  method: "delete",
  path: "/location/sessions/{id}",
  tags: ["location"],
  summary: "Stop location sharing session",
  description: "Stops an active location sharing session",
  request: {
    params: z.object({
      id: z.uuid({ error: "Invalid session ID" }),
    }),
  },
  responses: {
    200: {
      description: "Session stopped successfully",
      content: {
        "application/json": {
          schema: StopLocationSessionResponseSchema,
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
      description: "Session not found",
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

app.openapi(stopSessionRoute, async (c) => {
  const { user, supabase } = c.var;
  const { id } = c.req.valid("param");

  const locationRepo = new SupabaseLocationRepository(supabase);
  const locationService = new LocationService(locationRepo);

  const session = await locationService.stopSession(id, user.id);

  return c.json({ success: true, session }, 200);
});

// PUT /location/sessions/:id - Update location for session
const updateLocationRoute = createRoute({
  method: "put",
  path: "/location/sessions/{id}",
  tags: ["location"],
  summary: "Update location for session",
  description:
    "Updates the current location for an active location sharing session",
  request: {
    params: z.object({
      id: z.uuid({ error: "Invalid session ID" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: UpdateLocationSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Location updated successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
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
      description: "Session not found",
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

app.openapi(updateLocationRoute, async (c) => {
  const { user, supabase } = c.var;
  const { id } = c.req.valid("param");
  const { location } = c.req.valid("json");

  const locationRepo = new SupabaseLocationRepository(supabase);
  const locationService = new LocationService(locationRepo);

  await locationService.updateLocation(id, user.id, location);

  return c.json({ success: true }, 200);
});

// GET /location/nearby - Get nearby group members
const getNearbyMembersRoute = createRoute({
  method: "get",
  path: "/location/nearby",
  tags: ["location"],
  summary: "Get nearby group members",
  description:
    "Retrieves group members currently sharing their location near the user's position",
  request: {
    query: GetNearbyMembersQuerySchema,
  },
  responses: {
    200: {
      description: "Nearby members retrieved successfully",
      content: {
        "application/json": {
          schema: GetNearbyMembersResponseSchema,
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

app.openapi(getNearbyMembersRoute, async (c) => {
  const { user, supabase } = c.var;
  const query = c.req.valid("query");

  const locationRepo = new SupabaseLocationRepository(supabase);
  const locationService = new LocationService(locationRepo);

  const members = await locationService.getNearbyMembers(
    user.id,
    query.festivalId,
    query.latitude,
    query.longitude,
    query.radiusMeters,
    query.groupId,
  );

  return c.json(
    {
      members,
      userLocation: {
        latitude: query.latitude,
        longitude: query.longitude,
        timestamp: new Date().toISOString(),
      },
      radiusMeters: query.radiusMeters,
    },
    200,
  );
});

// Admin Routes

// GET /admin/location/sessions - List all active location sessions (admin)
const adminGetSessionsRoute = createRoute({
  method: "get",
  path: "/admin/location/sessions",
  tags: ["admin", "location"],
  summary: "List all active location sessions (admin)",
  description:
    "Retrieves all active location sessions with user and festival information. Admin only.",
  request: {
    query: z.object({
      festivalId: z.string().uuid().optional(),
      userId: z.string().uuid().optional(),
      includeExpired: z
        .string()
        .transform((v) => v === "true")
        .optional(),
    }),
  },
  responses: {
    200: {
      description: "Sessions retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            sessions: z.array(
              z.object({
                id: z.string().uuid(),
                userId: z.string().uuid(),
                festivalId: z.string().uuid(),
                isActive: z.boolean(),
                startedAt: z.string(),
                expiresAt: z.string(),
                createdAt: z.string(),
                updatedAt: z.string(),
                user: z.object({
                  id: z.string().uuid(),
                  username: z.string(),
                  fullName: z.string().nullable(),
                }),
                festival: z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                }),
              }),
            ),
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
    403: {
      description: "Forbidden - User is not an admin",
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

app.openapi(adminGetSessionsRoute, async (c) => {
  const { user, supabase } = c.var;
  const query = c.req.valid("query");

  const locationRepo = new SupabaseLocationRepository(supabase);
  const locationService = new LocationService(locationRepo);

  const sessions = await locationService.getActiveSessionsAdmin(user.id, {
    festivalId: query.festivalId,
    userId: query.userId,
    includeExpired: query.includeExpired,
  });

  return c.json({ sessions }, 200);
});

// DELETE /admin/location/sessions/:id - Force stop a location session (admin)
const adminForceStopSessionRoute = createRoute({
  method: "delete",
  path: "/admin/location/sessions/{id}",
  tags: ["admin", "location"],
  summary: "Force stop a location session (admin)",
  description:
    "Forcefully stops a location session regardless of ownership. Admin only.",
  request: {
    params: z.object({
      id: z.uuid({ error: "Invalid session ID" }),
    }),
  },
  responses: {
    200: {
      description: "Session stopped successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            session: z.object({
              id: z.string().uuid(),
              userId: z.string().uuid(),
              festivalId: z.string().uuid(),
              isActive: z.boolean(),
              startedAt: z.string(),
              expiresAt: z.string(),
            }),
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
    403: {
      description: "Forbidden - User is not an admin",
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
      description: "Session not found",
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

app.openapi(adminForceStopSessionRoute, async (c) => {
  const { user, supabase } = c.var;
  const { id } = c.req.valid("param");

  const locationRepo = new SupabaseLocationRepository(supabase);
  const locationService = new LocationService(locationRepo);

  const session = await locationService.forceStopSession(user.id, id);

  return c.json({ success: true, session }, 200);
});

// POST /admin/location/sessions/cleanup - Cleanup expired sessions (admin)
const adminCleanupSessionsRoute = createRoute({
  method: "post",
  path: "/admin/location/sessions/cleanup",
  tags: ["admin", "location"],
  summary: "Cleanup expired location sessions (admin)",
  description: "Marks all expired location sessions as inactive. Admin only.",
  responses: {
    200: {
      description: "Cleanup completed",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            cleanedCount: z.number(),
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
    403: {
      description: "Forbidden - User is not an admin",
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

app.openapi(adminCleanupSessionsRoute, async (c) => {
  const { user, supabase } = c.var;

  const locationRepo = new SupabaseLocationRepository(supabase);
  const locationService = new LocationService(locationRepo);

  const cleanedCount = await locationService.cleanupExpiredSessions(user.id);

  return c.json({ success: true, cleanedCount }, 200);
});

export default app;
