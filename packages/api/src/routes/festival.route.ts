import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  ListFestivalsQuerySchema,
  ListFestivalsResponseSchema,
  FestivalIdParamSchema,
  GetFestivalResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";

import { NotFoundError } from "../middleware/error";
import { SupabaseFestivalRepository } from "../repositories/supabase";

// Create router
const app = new OpenAPIHono<AuthContext>();

// GET /festivals - List all festivals
const listFestivalsRoute = createRoute({
  method: "get",
  path: "/festivals",
  tags: ["festivals"],
  summary: "List all festivals",
  description:
    "Returns list of festivals with optional filtering by status or active state",
  request: {
    query: ListFestivalsQuerySchema,
  },
  responses: {
    200: {
      description: "Festivals retrieved successfully",
      content: {
        "application/json": {
          schema: ListFestivalsResponseSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listFestivalsRoute, async (c) => {
  const supabase = c.var.supabase;
  const query = c.req.valid("query");

  const festivalRepo = new SupabaseFestivalRepository(supabase);
  const festivals = await festivalRepo.list(query);

  return c.json({ data: festivals }, 200);
});

// GET /festivals/:id - Get festival by ID
const getFestivalRoute = createRoute({
  method: "get",
  path: "/festivals/{id}",
  tags: ["festivals"],
  summary: "Get festival by ID",
  description: "Returns a single festival by its ID",
  request: {
    params: FestivalIdParamSchema,
  },
  responses: {
    200: {
      description: "Festival retrieved successfully",
      content: {
        "application/json": {
          schema: GetFestivalResponseSchema,
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
  security: [{ bearerAuth: [] }],
});

app.openapi(getFestivalRoute, async (c) => {
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");

  const festivalRepo = new SupabaseFestivalRepository(supabase);
  const festival = await festivalRepo.findById(id);

  if (!festival) {
    throw new NotFoundError("Festival not found");
  }

  return c.json(festival, 200);
});

export default app;
