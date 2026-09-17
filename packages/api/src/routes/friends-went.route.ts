import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { GetFriendsWentQuerySchema, GetFriendsWentResponseSchema } from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";
import { SupabaseFriendsWentRepository } from "../repositories/supabase";
import { FriendsWentService } from "../services/friends-went.service";

const app = new OpenAPIHono<AuthContext>();

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});

function errorResponse(description: string) {
  return {
    description,
    content: { "application/json": { schema: ErrorResponseSchema } },
  };
}

// GET /attendance/friends-went - Friends who logged a past festival day
const friendsWentRoute = createRoute({
  method: "get",
  path: "/attendance/friends-went",
  tags: ["attendance"],
  summary: "List friends who went on a past day",
  description:
    "Friends' and group-mates' attendance on a past festival day: drinks by type, tents and public photos. Empty for today and later.",
  request: {
    query: GetFriendsWentQuerySchema,
  },
  responses: {
    200: {
      description: "Friends who went retrieved successfully",
      content: { "application/json": { schema: GetFriendsWentResponseSchema } },
    },
    400: errorResponse("Invalid query"),
    401: errorResponse("Unauthorized"),
    404: errorResponse("Festival not found"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(friendsWentRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId, date } = c.req.valid("query");

  const service = new FriendsWentService(new SupabaseFriendsWentRepository(supabase));
  const friends = await service.getFriendsWent(user.id, festivalId, date);

  return c.json({ friends }, 200);
});

export default app;
