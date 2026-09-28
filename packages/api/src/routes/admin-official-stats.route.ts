import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  AdminFestivalOfficialStatsSchema,
  UpdateAdminFestivalOfficialStatsSchema,
} from "@prostcounter/shared";

import { ApiErrorSchema } from "../lib/error-response";
import type { AuthContext } from "../middleware/auth";
import { SupabaseOfficialStatsRepository } from "../repositories/supabase/official-stats.repository";

// Mounted under /admin/*, so requireAdmin guards both routes (see index.ts).
const app = new OpenAPIHono<AuthContext>();

const errorResponses = {
  401: { description: "Unauthorized", content: { "application/json": { schema: ApiErrorSchema } } },
  403: {
    description: "Forbidden - User is not an admin",
    content: { "application/json": { schema: ApiErrorSchema } },
  },
} as const;

const params = z.object({ festivalId: z.string().uuid() });

const getOfficialStatsRoute = createRoute({
  method: "get",
  path: "/admin/festivals/{festivalId}/official-stats",
  tags: ["admin"],
  summary: "Get a festival's official stats (admin)",
  request: { params },
  responses: {
    200: {
      description: "Official stats, or null when none are stored",
      content: {
        "application/json": {
          schema: z.object({ stats: AdminFestivalOfficialStatsSchema.nullable() }),
        },
      },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getOfficialStatsRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId } = c.req.valid("param");

  const stats = await new SupabaseOfficialStatsRepository(supabase).getForAdmin(festivalId);

  return c.json({ stats }, 200);
});

const putOfficialStatsRoute = createRoute({
  method: "put",
  path: "/admin/festivals/{festivalId}/official-stats",
  tags: ["admin"],
  summary: "Save a festival's official stats (admin)",
  request: {
    params,
    body: { content: { "application/json": { schema: UpdateAdminFestivalOfficialStatsSchema } } },
  },
  responses: {
    200: {
      description: "Official stats saved",
      content: {
        "application/json": { schema: z.object({ stats: AdminFestivalOfficialStatsSchema }) },
      },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(putOfficialStatsRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId } = c.req.valid("param");
  const body = c.req.valid("json");

  const stats = await new SupabaseOfficialStatsRepository(supabase).upsert(festivalId, body);

  return c.json({ stats }, 200);
});

export default app;
