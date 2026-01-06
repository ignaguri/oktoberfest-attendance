import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  GetWrappedResponseSchema,
  GenerateWrappedResponseSchema,
  WrappedAccessResultSchema,
  GetAvailableWrappedFestivalsResponseSchema,
  RegenerateWrappedCacheBodySchema,
  RegenerateWrappedCacheResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";

import { SupabaseWrappedRepository } from "../repositories/supabase";
import { WrappedService } from "../services/wrapped.service";

// Create router
const app = new OpenAPIHono<AuthContext>();

// GET /wrapped/:festivalId - Get wrapped data
const getWrappedRoute = createRoute({
  method: "get",
  path: "/wrapped/{festivalId}",
  tags: ["wrapped"],
  summary: "Get wrapped year-in-review data",
  description:
    "Returns cached wrapped statistics for a user and festival. Returns null if not yet generated.",
  request: {
    params: z.object({
      festivalId: z.uuid({ error: "Invalid festival ID" }),
    }),
  },
  responses: {
    200: {
      description: "Wrapped data retrieved successfully",
      content: {
        "application/json": {
          schema: GetWrappedResponseSchema,
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
      description: "Festival not found",
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
});

app.openapi(getWrappedRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId } = c.req.valid("param");

  const wrappedRepo = new SupabaseWrappedRepository(supabase);
  const wrappedService = new WrappedService(wrappedRepo);

  const result = await wrappedService.getWrapped(user.id, festivalId);

  return c.json(result, 200);
});

// POST /wrapped/:festivalId/generate - Generate wrapped data
const generateWrappedRoute = createRoute({
  method: "post",
  path: "/wrapped/{festivalId}/generate",
  tags: ["wrapped"],
  summary: "Generate wrapped year-in-review data",
  description:
    "Generates or regenerates wrapped statistics for a user and festival. Set force=true to regenerate even if cached.",
  request: {
    params: z.object({
      festivalId: z.uuid({ error: "Invalid festival ID" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            force: z.boolean().optional().default(false),
          }),
        },
      },
      required: false,
    },
  },
  responses: {
    200: {
      description: "Wrapped data generated successfully",
      content: {
        "application/json": {
          schema: GenerateWrappedResponseSchema,
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
      description: "Festival not found or no data available",
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
});

app.openapi(generateWrappedRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId } = c.req.valid("param");
  const body = await c.req.json().catch(() => ({ force: false }));
  const force = body.force || false;

  const wrappedRepo = new SupabaseWrappedRepository(supabase);
  const wrappedService = new WrappedService(wrappedRepo);

  const result = await wrappedService.generateWrapped(
    user.id,
    festivalId,
    force,
  );

  return c.json(result, 200);
});

// GET /wrapped/:festivalId/access - Check if user can access wrapped
const checkAccessRoute = createRoute({
  method: "get",
  path: "/wrapped/{festivalId}/access",
  tags: ["wrapped"],
  summary: "Check wrapped access",
  description:
    "Checks if the user is allowed to access wrapped data for a specific festival.",
  request: {
    params: z.object({
      festivalId: z.uuid({ error: "Invalid festival ID" }),
    }),
  },
  responses: {
    200: {
      description: "Access check result",
      content: {
        "application/json": {
          schema: WrappedAccessResultSchema,
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

app.openapi(checkAccessRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId } = c.req.valid("param");

  const wrappedRepo = new SupabaseWrappedRepository(supabase);
  const wrappedService = new WrappedService(wrappedRepo);

  const result = await wrappedService.checkAccess(user.id, festivalId);

  return c.json(result, 200);
});

// GET /wrapped/festivals - Get list of available wrapped festivals
const getAvailableFestivalsRoute = createRoute({
  method: "get",
  path: "/wrapped/festivals",
  tags: ["wrapped"],
  summary: "Get available wrapped festivals",
  description:
    "Returns a list of festivals for which wrapped data is available for the user.",
  responses: {
    200: {
      description: "Available festivals list",
      content: {
        "application/json": {
          schema: GetAvailableWrappedFestivalsResponseSchema,
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

app.openapi(getAvailableFestivalsRoute, async (c) => {
  const { user, supabase } = c.var;

  const wrappedRepo = new SupabaseWrappedRepository(supabase);
  const wrappedService = new WrappedService(wrappedRepo);

  const festivals = await wrappedService.getAvailableFestivals(user.id);

  return c.json({ festivals }, 200);
});

// POST /wrapped/regenerate - Admin function to regenerate wrapped cache
const regenerateCacheRoute = createRoute({
  method: "post",
  path: "/wrapped/regenerate",
  tags: ["wrapped"],
  summary: "Regenerate wrapped cache (admin only)",
  description:
    "Admin function to regenerate cached wrapped data for specific users or festivals.",
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
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    403: {
      description: "Forbidden - not an admin",
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

  const result = await wrappedService.regenerateCache(
    user.id,
    body.festivalId,
    body.userId,
  );

  return c.json(result, 200);
});

export default app;
