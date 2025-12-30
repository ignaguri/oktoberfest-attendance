import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  CreateGroupSchema,
  GroupSchema,
  ListGroupsQuerySchema,
  ListGroupsResponseSchema,
  GroupIdParamSchema,
  GroupWithMembersSchema,
  JoinGroupSchema,
  GroupActionResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";

import { SupabaseGroupRepository } from "../repositories/supabase";
import { GroupService } from "../services/group.service";

// Create router
const app = new OpenAPIHono<AuthContext>();

// POST /groups - Create a new group
const createGroupRoute = createRoute({
  method: "post",
  path: "/groups",
  tags: ["groups"],
  summary: "Create a new group",
  description:
    "Creates a group and automatically adds the creator as the first member",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateGroupSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Group created successfully",
      content: {
        "application/json": {
          schema: GroupSchema,
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

app.openapi(createGroupRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const data = c.req.valid("json");

  const groupRepo = new SupabaseGroupRepository(supabase);
  const service = new GroupService(groupRepo);

  const group = await service.createGroup(user.id, data);

  return c.json(group, 200);
});

// GET /groups - List user's groups
const listGroupsRoute = createRoute({
  method: "get",
  path: "/groups",
  tags: ["groups"],
  summary: "List user's groups",
  description: "Returns all groups the user is a member of",
  request: {
    query: ListGroupsQuerySchema,
  },
  responses: {
    200: {
      description: "Groups retrieved successfully",
      content: {
        "application/json": {
          schema: ListGroupsResponseSchema,
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

app.openapi(listGroupsRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const query = c.req.valid("query");

  const groupRepo = new SupabaseGroupRepository(supabase);
  const service = new GroupService(groupRepo);

  const groups = await service.listUserGroups(user.id, query);

  return c.json({ data: groups }, 200);
});

// GET /groups/:id - Get group details
const getGroupRoute = createRoute({
  method: "get",
  path: "/groups/{id}",
  tags: ["groups"],
  summary: "Get group details",
  description: "Returns group information including member count",
  request: {
    params: GroupIdParamSchema,
  },
  responses: {
    200: {
      description: "Group retrieved successfully",
      content: {
        "application/json": {
          schema: GroupWithMembersSchema,
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

app.openapi(getGroupRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");

  const groupRepo = new SupabaseGroupRepository(supabase);
  const service = new GroupService(groupRepo);

  const group = await service.getGroup(id, user.id);

  return c.json(group, 200);
});

// POST /groups/:id/join - Join a group
const joinGroupRoute = createRoute({
  method: "post",
  path: "/groups/{id}/join",
  tags: ["groups"],
  summary: "Join a group",
  description: "Join a group using an optional invite token",
  request: {
    params: GroupIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: JoinGroupSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Successfully joined group",
      content: {
        "application/json": {
          schema: GroupActionResponseSchema,
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
      description: "Forbidden - Invalid invite token",
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
    409: {
      description: "Conflict - Already a member",
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

app.openapi(joinGroupRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const groupRepo = new SupabaseGroupRepository(supabase);
  const service = new GroupService(groupRepo);

  await service.joinGroup(id, user.id, body.inviteToken);

  return c.json(
    {
      success: true,
      message: "Successfully joined group",
    },
    200,
  );
});

// POST /groups/:id/leave - Leave a group
const leaveGroupRoute = createRoute({
  method: "post",
  path: "/groups/{id}/leave",
  tags: ["groups"],
  summary: "Leave a group",
  description: "Remove yourself from a group",
  request: {
    params: GroupIdParamSchema,
  },
  responses: {
    200: {
      description: "Successfully left group",
      content: {
        "application/json": {
          schema: GroupActionResponseSchema,
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

app.openapi(leaveGroupRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");

  const groupRepo = new SupabaseGroupRepository(supabase);
  const service = new GroupService(groupRepo);

  await service.leaveGroup(id, user.id);

  return c.json(
    {
      success: true,
      message: "Successfully left group",
    },
    200,
  );
});

export default app;
