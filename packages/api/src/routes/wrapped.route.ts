import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  GetWrappedFestivalsResponseSchema,
  GetWrappedResponseSchema,
  RegenerateWrappedCacheBodySchema,
  RegenerateWrappedCacheResponseSchema,
  WrappedAccessResultSchema,
} from "@prostcounter/shared";

import { ApiErrorSchema } from "../lib/error-response";
import type { AuthContext } from "../middleware/auth";
import { SupabaseWrappedRepository } from "../repositories/supabase";
import { evaluateAfterWrite } from "../services/evaluate-after-write";
import { WrappedService } from "../services/wrapped.service";

const app = new OpenAPIHono<AuthContext>();

const unauthorized = {
  description: "Unauthorized",
  content: { "application/json": { schema: ApiErrorSchema } },
};

const festivalParams = z.object({
  festivalId: z.uuid({ error: "Invalid festival ID" }),
});

// GET /wrapped - every unlocked festival the user attended.
// Registered before /wrapped/{festivalId} so the path is never read as an id.
const listFestivalsRoute = createRoute({
  method: "get",
  path: "/wrapped",
  tags: ["wrapped"],
  summary: "List the user's Wrapped archive",
  description: "Every festival the user attended whose Wrapped has unlocked, newest first.",
  responses: {
    200: {
      description: "Wrapped archive",
      content: { "application/json": { schema: GetWrappedFestivalsResponseSchema } },
    },
    401: unauthorized,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listFestivalsRoute, async (c) => {
  const { supabase } = c.var;
  const wrappedService = new WrappedService(new SupabaseWrappedRepository(supabase));

  const festivals = await wrappedService.listFestivals();

  return c.json({ festivals }, 200);
});

// GET /wrapped/:festivalId - the Wrapped, or why it is not available
const getWrappedRoute = createRoute({
  method: "get",
  path: "/wrapped/{festivalId}",
  tags: ["wrapped"],
  summary: "Get wrapped year-in-review data",
  description:
    "status=ready with the data, status=locked with unlocksAt (00:00 festival time the day after it ends), or status=not_attended.",
  request: { params: festivalParams },
  responses: {
    200: {
      description: "Wrapped status and data",
      content: { "application/json": { schema: GetWrappedResponseSchema } },
    },
    401: unauthorized,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getWrappedRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId } = c.req.valid("param");
  const wrappedService = new WrappedService(new SupabaseWrappedRepository(supabase));

  const result = await wrappedService.getWrapped(user.id, festivalId);

  if (result.status === "ready") {
    // Evaluate-only: the unlock reaches the client through the outbox, not this
    // response. Awaited so the outbox row exists before the client's next read.
    await evaluateAfterWrite(supabase, user.id, festivalId, "GET /wrapped/{festivalId}");
  }

  return c.json(result, 200);
});

// GET /wrapped/:festivalId/access - deprecated
const checkAccessRoute = createRoute({
  method: "get",
  path: "/wrapped/{festivalId}/access",
  tags: ["wrapped"],
  summary: "Check wrapped access (deprecated)",
  description: "Kept for installed app versions. New clients read status from GET /wrapped/{festivalId}.",
  deprecated: true,
  request: { params: festivalParams },
  responses: {
    200: {
      description: "Access check result",
      content: { "application/json": { schema: WrappedAccessResultSchema } },
    },
    401: unauthorized,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(checkAccessRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId } = c.req.valid("param");
  const wrappedService = new WrappedService(new SupabaseWrappedRepository(supabase));

  const result = await wrappedService.checkAccessLegacy(festivalId);

  return c.json(result, 200);
});

// POST /wrapped/regenerate - Admin function to regenerate wrapped cache
const regenerateCacheRoute = createRoute({
  method: "post",
  path: "/wrapped/regenerate",
  tags: ["wrapped"],
  summary: "Regenerate wrapped cache (admin only)",
  description: "Admin function to regenerate cached wrapped data for specific users or festivals.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RegenerateWrappedCacheBodySchema,
        },
      },
      required: false,
    },
  },
  responses: {
    200: {
      description: "Cache regeneration result",
      content: {
        "application/json": {
          schema: RegenerateWrappedCacheResponseSchema,
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
    403: {
      description: "Forbidden - not an admin",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(regenerateCacheRoute, async (c) => {
  const { user, supabase } = c.var;
  // Parse optional body - use empty object if not provided or invalid JSON
  let body: { festivalId?: string; userId?: string } = {};
  try {
    const contentType = c.req.header("content-type");
    if (contentType?.includes("application/json")) {
      body = await c.req.json();
    }
  } catch {
    // Body is optional, so empty object is acceptable
  }

  const wrappedRepo = new SupabaseWrappedRepository(supabase);
  const wrappedService = new WrappedService(wrappedRepo);

  const result = await wrappedService.regenerateCache(user.id, body.festivalId, body.userId);

  return c.json(result, 200);
});

export default app;
