import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  AdminAttendanceSchema,
  AdminGroupMemberSchema,
  AdminGroupSchema,
  AdminUserSchema,
  ListAdminUsersResponseSchema,
  UpdateAdminAttendanceSchema,
  UpdateAdminUserAuthSchema,
  UpdateAdminGroupSchema,
  UpdateAdminUserProfileSchema,
  WinningCriterionSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";
import { ForbiddenError, NotFoundError } from "../middleware/error";
import { SupabaseAdminRepository } from "../repositories/supabase/admin.repository";

/**
 * Admin routes for user and attendance management.
 *
 * Every path here is mounted under `/admin`, which `requireAdmin` guards as a
 * prefix in index.ts -- there is deliberately no per-handler admin check to
 * forget. The one thing handlers do enforce themselves is self-protection:
 * an admin cannot delete or demote their own account.
 */
const app = new OpenAPIHono<AuthContext>();

/** Shared error body for the documented failure responses. */
const errorSchema = z.object({ error: z.string(), message: z.string() });

const errorResponses = {
  401: {
    description: "Unauthorized",
    content: { "application/json": { schema: errorSchema } },
  },
  403: {
    description: "Forbidden - User is not an admin",
    content: { "application/json": { schema: errorSchema } },
  },
} as const;

// GET /admin/users - List users with optional search
const listUsersRoute = createRoute({
  method: "get",
  path: "/admin/users",
  tags: ["admin"],
  summary: "List users (admin)",
  description:
    "Lists users with their profiles, optionally filtered by email, username or full name.",
  request: {
    query: z.object({
      search: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  },
  responses: {
    200: {
      description: "Users retrieved successfully",
      content: { "application/json": { schema: ListAdminUsersResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listUsersRoute, async (c) => {
  const { supabase } = c.var;
  const { search, page, limit } = c.req.valid("query");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const result = await adminRepo.listUsers(search, page, limit);

  return c.json(result, 200);
});

// GET /admin/users/:userId - Get one user
const getUserRoute = createRoute({
  method: "get",
  path: "/admin/users/{userId}",
  tags: ["admin"],
  summary: "Get a user (admin)",
  description: "Returns one user with their profile, for the admin detail view.",
  request: {
    params: z.object({ userId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "User retrieved successfully",
      content: { "application/json": { schema: z.object({ user: AdminUserSchema }) } },
    },
    ...errorResponses,
    404: {
      description: "User not found",
      content: { "application/json": { schema: errorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getUserRoute, async (c) => {
  const { supabase } = c.var;
  const { userId } = c.req.valid("param");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const user = await adminRepo.getUser(userId);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return c.json({ user }, 200);
});

// PATCH /admin/users/:userId/profile - Update a user's profile
const updateUserProfileRoute = createRoute({
  method: "patch",
  path: "/admin/users/{userId}/profile",
  tags: ["admin"],
  summary: "Update a user's profile (admin)",
  request: {
    params: z.object({ userId: z.string().uuid() }),
    body: {
      content: { "application/json": { schema: UpdateAdminUserProfileSchema } },
    },
  },
  responses: {
    200: {
      description: "Profile updated successfully",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updateUserProfileRoute, async (c) => {
  const { user, supabase } = c.var;
  const { userId } = c.req.valid("param");
  const body = c.req.valid("json");

  // Revoking your own admin rights locks you out of this panel with no way
  // back in from either app.
  if (userId === user.id && body.is_super_admin === false) {
    throw new ForbiddenError("You cannot revoke your own admin access");
  }

  const adminRepo = new SupabaseAdminRepository(supabase);
  await adminRepo.updateUserProfile(userId, body);

  return c.json({ success: true }, 200);
});

// PATCH /admin/users/:userId/auth - Update a user's email or password
const updateUserAuthRoute = createRoute({
  method: "patch",
  path: "/admin/users/{userId}/auth",
  tags: ["admin"],
  summary: "Update a user's email or password (admin)",
  description: "Changes credentials via the service role. Requires at least one field.",
  request: {
    params: z.object({ userId: z.string().uuid() }),
    body: {
      content: { "application/json": { schema: UpdateAdminUserAuthSchema } },
    },
  },
  responses: {
    200: {
      description: "Credentials updated successfully",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updateUserAuthRoute, async (c) => {
  const { supabase } = c.var;
  const { userId } = c.req.valid("param");
  const body = c.req.valid("json");

  const adminRepo = new SupabaseAdminRepository(supabase);
  await adminRepo.updateUserAuth(userId, body);

  return c.json({ success: true }, 200);
});

// DELETE /admin/users/:userId - Delete a user
const deleteUserRoute = createRoute({
  method: "delete",
  path: "/admin/users/{userId}",
  tags: ["admin"],
  summary: "Delete a user (admin)",
  request: {
    params: z.object({ userId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "User deleted successfully",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(deleteUserRoute, async (c) => {
  const { user, supabase } = c.var;
  const { userId } = c.req.valid("param");

  if (userId === user.id) {
    throw new ForbiddenError("You cannot delete your own account from the admin panel");
  }

  const adminRepo = new SupabaseAdminRepository(supabase);
  await adminRepo.deleteUser(userId);

  return c.json({ success: true }, 200);
});

// GET /admin/users/:userId/attendances - List a user's attendances
const listUserAttendancesRoute = createRoute({
  method: "get",
  path: "/admin/users/{userId}/attendances",
  tags: ["admin"],
  summary: "List a user's attendances (admin)",
  description: "Returns every attendance for the user with the tents visited on each day.",
  request: {
    params: z.object({ userId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Attendances retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({ attendances: z.array(AdminAttendanceSchema) }),
        },
      },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listUserAttendancesRoute, async (c) => {
  const { supabase } = c.var;
  const { userId } = c.req.valid("param");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const attendances = await adminRepo.listUserAttendances(userId);

  return c.json({ attendances }, 200);
});

// PATCH /admin/attendances/:attendanceId - Update an attendance
const updateAttendanceRoute = createRoute({
  method: "patch",
  path: "/admin/attendances/{attendanceId}",
  tags: ["admin"],
  summary: "Update an attendance (admin)",
  description:
    "Updates beer count and/or date, and replaces that day's tent visits when tent_ids is supplied.",
  request: {
    params: z.object({ attendanceId: z.string().uuid() }),
    body: {
      content: { "application/json": { schema: UpdateAdminAttendanceSchema } },
    },
  },
  responses: {
    200: {
      description: "Attendance updated successfully",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...errorResponses,
    404: {
      description: "Attendance not found",
      content: { "application/json": { schema: errorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updateAttendanceRoute, async (c) => {
  const { supabase } = c.var;
  const { attendanceId } = c.req.valid("param");
  const body = c.req.valid("json");

  const adminRepo = new SupabaseAdminRepository(supabase);
  await adminRepo.updateAttendance(attendanceId, body);

  return c.json({ success: true }, 200);
});

// DELETE /admin/attendances/:attendanceId - Delete an attendance
const deleteAttendanceRoute = createRoute({
  method: "delete",
  path: "/admin/attendances/{attendanceId}",
  tags: ["admin"],
  summary: "Delete an attendance (admin)",
  request: {
    params: z.object({ attendanceId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Attendance deleted successfully",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(deleteAttendanceRoute, async (c) => {
  const { supabase } = c.var;
  const { attendanceId } = c.req.valid("param");

  const adminRepo = new SupabaseAdminRepository(supabase);
  await adminRepo.deleteAttendance(attendanceId);

  return c.json({ success: true }, 200);
});

// GET /admin/groups - List all groups
const listGroupsRoute = createRoute({
  method: "get",
  path: "/admin/groups",
  tags: ["admin"],
  summary: "List groups (admin)",
  description: "Lists every group with its member count. Excludes group passwords.",
  responses: {
    200: {
      description: "Groups retrieved successfully",
      content: {
        "application/json": { schema: z.object({ groups: z.array(AdminGroupSchema) }) },
      },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listGroupsRoute, async (c) => {
  const { supabase } = c.var;
  const adminRepo = new SupabaseAdminRepository(supabase);
  const groups = await adminRepo.listGroups();
  return c.json({ groups }, 200);
});

// GET /admin/winning-criteria - List winning criteria
// Declared before /admin/groups/{groupId} so the literal path is not shadowed.
const listWinningCriteriaRoute = createRoute({
  method: "get",
  path: "/admin/winning-criteria",
  tags: ["admin"],
  summary: "List winning criteria (admin)",
  responses: {
    200: {
      description: "Winning criteria retrieved successfully",
      content: {
        "application/json": { schema: z.object({ criteria: z.array(WinningCriterionSchema) }) },
      },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listWinningCriteriaRoute, async (c) => {
  const { supabase } = c.var;
  const adminRepo = new SupabaseAdminRepository(supabase);
  const criteria = await adminRepo.listWinningCriteria();
  return c.json({ criteria }, 200);
});

// GET /admin/groups/:groupId - Get one group
const getGroupRoute = createRoute({
  method: "get",
  path: "/admin/groups/{groupId}",
  tags: ["admin"],
  summary: "Get a group (admin)",
  request: { params: z.object({ groupId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Group retrieved successfully",
      content: { "application/json": { schema: z.object({ group: AdminGroupSchema }) } },
    },
    ...errorResponses,
    404: {
      description: "Group not found",
      content: { "application/json": { schema: errorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getGroupRoute, async (c) => {
  const { supabase } = c.var;
  const { groupId } = c.req.valid("param");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const group = await adminRepo.getGroup(groupId);

  if (!group) {
    throw new NotFoundError("Group not found");
  }

  return c.json({ group }, 200);
});

// PATCH /admin/groups/:groupId - Update a group
const updateGroupRoute = createRoute({
  method: "patch",
  path: "/admin/groups/{groupId}",
  tags: ["admin"],
  summary: "Update a group (admin)",
  request: {
    params: z.object({ groupId: z.string().uuid() }),
    body: { content: { "application/json": { schema: UpdateAdminGroupSchema } } },
  },
  responses: {
    200: {
      description: "Group updated successfully",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updateGroupRoute, async (c) => {
  const { supabase } = c.var;
  const { groupId } = c.req.valid("param");
  const body = c.req.valid("json");

  const adminRepo = new SupabaseAdminRepository(supabase);
  await adminRepo.updateGroup(groupId, body);

  return c.json({ success: true }, 200);
});

// DELETE /admin/groups/:groupId - Delete a group
const deleteGroupRoute = createRoute({
  method: "delete",
  path: "/admin/groups/{groupId}",
  tags: ["admin"],
  summary: "Delete a group (admin)",
  description: "Deletes the group; memberships cascade.",
  request: { params: z.object({ groupId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Group deleted successfully",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(deleteGroupRoute, async (c) => {
  const { supabase } = c.var;
  const { groupId } = c.req.valid("param");

  const adminRepo = new SupabaseAdminRepository(supabase);
  await adminRepo.deleteGroup(groupId);

  return c.json({ success: true }, 200);
});

// GET /admin/groups/:groupId/members - List a group's members
const listGroupMembersRoute = createRoute({
  method: "get",
  path: "/admin/groups/{groupId}/members",
  tags: ["admin"],
  summary: "List a group's members (admin)",
  request: { params: z.object({ groupId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Members retrieved successfully",
      content: {
        "application/json": { schema: z.object({ members: z.array(AdminGroupMemberSchema) }) },
      },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listGroupMembersRoute, async (c) => {
  const { supabase } = c.var;
  const { groupId } = c.req.valid("param");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const members = await adminRepo.listGroupMembers(groupId);

  return c.json({ members }, 200);
});

export default app;
