import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  ListTentsQuerySchema,
  ListTentsResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";

import { SupabaseTentRepository } from "../repositories/supabase";

// Create router
const app = new OpenAPIHono<AuthContext>();

// GET /tents - List tents for a festival
const listTentsRoute = createRoute({
  method: "get",
  path: "/tents",
  tags: ["tents"],
  summary: "List tents for a festival",
  description:
    "Returns list of tents with festival-specific pricing and availability",
  request: {
    query: ListTentsQuerySchema,
  },
  responses: {
    200: {
      description: "Tents retrieved successfully",
      content: {
        "application/json": {
          schema: ListTentsResponseSchema,
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

app.openapi(listTentsRoute, async (c) => {
  const supabase = c.var.supabase;
  const { festivalId } = c.req.valid("query");

  const tentRepo = new SupabaseTentRepository(supabase);
  const tents = await tentRepo.listByFestival(festivalId);

  return c.json({ data: tents }, 200);
});

export default app;
