import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  CreateGroupSchema,
  UpdateGroupSchema,
  GroupSchema,
  ListGroupsQuerySchema,
  ListGroupsResponseSchema,
  GroupIdParamSchema,
  GroupWithMembersSchema,
  JoinGroupSchema,
  GroupActionResponseSchema,
  SearchGroupsQuerySchema,
  SearchGroupsResponseSchema,
  ListGroupMembersResponseSchema,
  GroupMemberParamSchema,
  RenewTokenResponseSchema,
  JoinByTokenSchema,
  JoinByTokenResponseSchema,
  GroupGalleryResponseSchema,
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

// GET /groups/search - Search groups by name
const searchGroupsRoute = createRoute({
  method: "get",
  path: "/groups/search",
  tags: ["groups"],
  summary: "Search groups by name",
  description:
    "Search for groups by name. Returns public group info (no invite tokens).",
  request: {
    query: SearchGroupsQuerySchema,
  },
  responses: {
    200: {
      description: "Groups found",
      content: {
        "application/json": {
          schema: SearchGroupsResponseSchema,
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

app.openapi(searchGroupsRoute, async (c) => {
  const supabase = c.var.supabase;
  const query = c.req.valid("query");

  const groupRepo = new SupabaseGroupRepository(supabase);
  const groups = await groupRepo.search(query);

  return c.json({ data: groups }, 200);
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

  // If we get here, the user is a member (service throws if not)
  return c.json({ ...group, isMember: true }, 200);
});

// PUT /groups/:id - Update group settings
const updateGroupRoute = createRoute({
  method: "put",
  path: "/groups/{id}",
  tags: ["groups"],
  summary: "Update group settings",
  description:
    "Update group name, winning criteria, or description. Only the group creator can update.",
  request: {
    params: GroupIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: UpdateGroupSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Group updated successfully",
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
    403: {
      description: "Forbidden - Not the group creator",
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

app.openapi(updateGroupRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");
  const data = c.req.valid("json");

  const groupRepo = new SupabaseGroupRepository(supabase);
  const service = new GroupService(groupRepo);

  const group = await service.updateGroup(id, user.id, data);

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

// GET /groups/:id/members - List group members
const listMembersRoute = createRoute({
  method: "get",
  path: "/groups/{id}/members",
  tags: ["groups"],
  summary: "List group members",
  description: "Returns all members of a group with their profile information",
  request: {
    params: GroupIdParamSchema,
  },
  responses: {
    200: {
      description: "Members retrieved successfully",
      content: {
        "application/json": {
          schema: ListGroupMembersResponseSchema,
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

app.openapi(listMembersRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");

  const groupRepo = new SupabaseGroupRepository(supabase);
  const service = new GroupService(groupRepo);

  const members = await service.getMembers(id, user.id);

  return c.json({ data: members }, 200);
});

// DELETE /groups/:id/members/:userId - Remove a member from group
const removeMemberRoute = createRoute({
  method: "delete",
  path: "/groups/{id}/members/{userId}",
  tags: ["groups"],
  summary: "Remove a member from group",
  description:
    "Remove a user from the group. Only the group creator can do this.",
  request: {
    params: GroupMemberParamSchema,
  },
  responses: {
    200: {
      description: "Member removed successfully",
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
      description: "Forbidden - Not the group creator",
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
      description: "Group or member not found",
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

app.openapi(removeMemberRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id, userId } = c.req.valid("param");

  const groupRepo = new SupabaseGroupRepository(supabase);
  const service = new GroupService(groupRepo);

  await service.removeMember(id, user.id, userId);

  return c.json(
    {
      success: true,
      message: "Member removed successfully",
    },
    200,
  );
});

// POST /groups/:id/token/renew - Regenerate invite token
const renewTokenRoute = createRoute({
  method: "post",
  path: "/groups/{id}/token/renew",
  tags: ["groups"],
  summary: "Regenerate invite token",
  description:
    "Generate a new invite token for the group. Only the group creator can do this.",
  request: {
    params: GroupIdParamSchema,
  },
  responses: {
    200: {
      description: "Token renewed successfully",
      content: {
        "application/json": {
          schema: RenewTokenResponseSchema,
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
      description: "Forbidden - Not the group creator",
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

app.openapi(renewTokenRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");

  const groupRepo = new SupabaseGroupRepository(supabase);
  const service = new GroupService(groupRepo);

  const inviteToken = await service.renewInviteToken(id, user.id);

  return c.json({ inviteToken }, 200);
});

// GET /groups/:id/gallery - Get group photo gallery
const getGalleryRoute = createRoute({
  method: "get",
  path: "/groups/{id}/gallery",
  tags: ["groups"],
  summary: "Get group photo gallery",
  description:
    "Returns all public photos shared by group members for the group's festival",
  request: {
    params: GroupIdParamSchema,
  },
  responses: {
    200: {
      description: "Gallery retrieved successfully",
      content: {
        "application/json": {
          schema: GroupGalleryResponseSchema,
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

app.openapi(getGalleryRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { id } = c.req.valid("param");

  const groupRepo = new SupabaseGroupRepository(supabase);
  const service = new GroupService(groupRepo);

  const photos = await service.getGallery(id, user.id);

  return c.json({ data: photos, total: photos.length }, 200);
});

// POST /groups/join-by-token - Join a group using invite token
const joinByTokenRoute = createRoute({
  method: "post",
  path: "/groups/join-by-token",
  tags: ["groups"],
  summary: "Join a group by invite token",
  description:
    "Join a group using only the invite token, without knowing the group ID",
  request: {
    body: {
      content: {
        "application/json": {
          schema: JoinByTokenSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Successfully joined group",
      content: {
        "application/json": {
          schema: JoinByTokenResponseSchema,
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
      description: "Invalid invite token",
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

app.openapi(joinByTokenRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { inviteToken } = c.req.valid("json");

  const groupRepo = new SupabaseGroupRepository(supabase);
  const service = new GroupService(groupRepo);

  const group = await service.joinByToken(inviteToken, user.id);

  return c.json(
    {
      success: true,
      message: "Successfully joined group",
      group,
    },
    200,
  );
});

export default app;
