import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  GlobalLeaderboardQuerySchema,
  GroupLeaderboardQuerySchema,
  GroupIdParamSchema,
  LeaderboardResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";

import { NotFoundError, ForbiddenError } from "../middleware/error";
import {
  SupabaseLeaderboardRepository,
  SupabaseGroupRepository,
} from "../repositories/supabase";

// Create router
const app = new OpenAPIHono<AuthContext>();

// GET /leaderboard - Global leaderboard
const globalLeaderboardRoute = createRoute({
  method: "get",
  path: "/leaderboard",
  tags: ["leaderboard"],
  summary: "Get global leaderboard",
  description:
    "Returns ranked list of all users for a festival with pagination",
  request: {
    query: GlobalLeaderboardQuerySchema,
  },
  responses: {
    200: {
      description: "Leaderboard retrieved successfully",
      content: {
        "application/json": {
          schema: LeaderboardResponseSchema,
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

app.openapi(globalLeaderboardRoute, async (c) => {
  const supabase = c.var.supabase;
  const query = c.req.valid("query");

  const leaderboardRepo = new SupabaseLeaderboardRepository(supabase);
  const result = await leaderboardRepo.getGlobal(query);

  return c.json(
    {
      data: result.data,
      total: result.total,
      limit: query.limit,
      offset: query.offset,
    },
    200,
  );
});

// GET /groups/:id/leaderboard - Group leaderboard
const groupLeaderboardRoute = createRoute({
  method: "get",
  path: "/groups/{id}/leaderboard",
  tags: ["leaderboard"],
  summary: "Get group leaderboard",
  description: "Returns ranked list of group members",
  request: {
    params: GroupIdParamSchema,
    query: GroupLeaderboardQuerySchema,
  },
  responses: {
    200: {
      description: "Group leaderboard retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(LeaderboardResponseSchema.shape.data.element),
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
      description: "Forbidden - Not a group member",
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

app.openapi(groupLeaderboardRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");

  // Verify group exists and user is a member
  const groupRepo = new SupabaseGroupRepository(supabase);
  const group = await groupRepo.findById(id);

  if (!group) {
    throw new NotFoundError("Group not found");
  }

  const isMember = await groupRepo.isMember(id, user.id);
  if (!isMember) {
    throw new ForbiddenError("You are not a member of this group");
  }

  const leaderboardRepo = new SupabaseLeaderboardRepository(supabase);
  const data = await leaderboardRepo.getForGroup(id, query);

  return c.json({ data }, 200);
});

export default app;
