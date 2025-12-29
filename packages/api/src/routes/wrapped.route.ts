import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  GetWrappedQuerySchema,
  GetWrappedResponseSchema,
  GenerateWrappedBodySchema,
  GenerateWrappedResponseSchema,
} from "@prostcounter/shared";
import { WrappedService } from "../services/wrapped.service";
import { SupabaseWrappedRepository } from "../repositories/supabase";
import type { AuthContext } from "../middleware/auth";

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
      festivalId: z.string().uuid("Invalid festival ID"),
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
      festivalId: z.string().uuid("Invalid festival ID"),
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

  const result = await wrappedService.generateWrapped(user.id, festivalId, force);

  return c.json(result, 200);
});

export default app;
