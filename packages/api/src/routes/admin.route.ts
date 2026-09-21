import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  AddAdminFestivalTentSchema,
  AddAllAdminFestivalTentsSchema,
  AdminAttendanceSchema,
  AdminFestivalSchema,
  AdminFestivalTentSchema,
  AdminFestivalTentStatsSchema,
  AdminGroupMemberSchema,
  AdminGroupSchema,
  AdminTentSchema,
  AdminUserGroupSchema,
  AdminUserSchema,
  AdminWrappedCacheEntrySchema,
  CopyAdminFestivalTentsSchema,
  CreateAdminFestivalSchema,
  CreateAdminTentSchema,
  ListAdminUsersResponseSchema,
  UpdateAdminAttendanceSchema,
  UpdateAdminFestivalTentPriceSchema,
  UpdateAdminUserAuthSchema,
  UpdateAdminFestivalSchema,
  UpdateAdminGroupSchema,
  UpdateAdminTentSchema,
  UpdateAdminUserProfileSchema,
  WinningCriterionSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../middleware/error";
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
  description:
    "Updates username and/or full name. Admin rights are not settable here: they are granted in the database only.",
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
  const { supabase } = c.var;
  const { userId } = c.req.valid("param");
  const body = c.req.valid("json");

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

// GET /admin/users/:userId/groups - List the groups a user belongs to
const listUserGroupsRoute = createRoute({
  method: "get",
  path: "/admin/users/{userId}/groups",
  tags: ["admin"],
  summary: "List a user's groups (admin)",
  description: "Returns every group the user is a member of, most recently joined first.",
  request: {
    params: z.object({ userId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Groups retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({ groups: z.array(AdminUserGroupSchema) }),
        },
      },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listUserGroupsRoute, async (c) => {
  const { supabase } = c.var;
  const { userId } = c.req.valid("param");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const groups = await adminRepo.listUserGroups(userId);

  return c.json({ groups }, 200);
});

// PATCH /admin/attendances/:attendanceId - Update an attendance
const updateAttendanceRoute = createRoute({
  method: "patch",
  path: "/admin/attendances/{attendanceId}",
  tags: ["admin"],
  summary: "Update an attendance (admin)",
  description:
    "Updates beer count and/or date, and replaces that day's tent visits when tent_ids is supplied. Changing the date clears the old day's visits too.",
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
    409: {
      description: "The user already has an attendance on the requested date",
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
  const updated = await adminRepo.updateGroup(groupId, body);

  if (!updated) {
    throw new NotFoundError("Group not found");
  }

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
  const deleted = await adminRepo.deleteGroup(groupId);

  if (!deleted) {
    throw new NotFoundError("Group not found");
  }

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

// ===========================================================================
// Festivals
// ===========================================================================

// GET /admin/festivals - List all festivals
const listFestivalsRoute = createRoute({
  method: "get",
  path: "/admin/festivals",
  tags: ["admin"],
  summary: "List festivals (admin)",
  responses: {
    200: {
      description: "Festivals retrieved successfully",
      content: {
        "application/json": { schema: z.object({ festivals: z.array(AdminFestivalSchema) }) },
      },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listFestivalsRoute, async (c) => {
  const { supabase } = c.var;
  const adminRepo = new SupabaseAdminRepository(supabase);
  const festivals = await adminRepo.listFestivals();
  return c.json({ festivals }, 200);
});

// POST /admin/festivals - Create a festival
const createFestivalRoute = createRoute({
  method: "post",
  path: "/admin/festivals",
  tags: ["admin"],
  summary: "Create a festival (admin)",
  description:
    "Creates a festival. Marking it active clears is_active on the current one, which a unique partial index otherwise rejects.",
  request: {
    body: { content: { "application/json": { schema: CreateAdminFestivalSchema } } },
  },
  responses: {
    201: {
      description: "Festival created successfully",
      content: { "application/json": { schema: z.object({ festival: AdminFestivalSchema }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(createFestivalRoute, async (c) => {
  const { supabase } = c.var;
  const body = c.req.valid("json");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const festival = await adminRepo.createFestival(body);

  return c.json({ festival }, 201);
});

// GET /admin/festivals/:festivalId - Get one festival
const getFestivalRoute = createRoute({
  method: "get",
  path: "/admin/festivals/{festivalId}",
  tags: ["admin"],
  summary: "Get a festival (admin)",
  request: { params: z.object({ festivalId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Festival retrieved successfully",
      content: { "application/json": { schema: z.object({ festival: AdminFestivalSchema }) } },
    },
    ...errorResponses,
    404: {
      description: "Festival not found",
      content: { "application/json": { schema: errorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getFestivalRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId } = c.req.valid("param");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const festival = await adminRepo.getFestival(festivalId);

  if (!festival) {
    throw new NotFoundError("Festival not found");
  }

  return c.json({ festival }, 200);
});

// PATCH /admin/festivals/:festivalId - Update a festival
const updateFestivalRoute = createRoute({
  method: "patch",
  path: "/admin/festivals/{festivalId}",
  tags: ["admin"],
  summary: "Update a festival (admin)",
  request: {
    params: z.object({ festivalId: z.string().uuid() }),
    body: { content: { "application/json": { schema: UpdateAdminFestivalSchema } } },
  },
  responses: {
    200: {
      description: "Festival updated successfully",
      content: { "application/json": { schema: z.object({ festival: AdminFestivalSchema }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updateFestivalRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId } = c.req.valid("param");
  const body = c.req.valid("json");

  const adminRepo = new SupabaseAdminRepository(supabase);

  // The schema can only compare the two dates when a request carries both.
  // Patching one alone has to be checked against the stored other, or a lone
  // end_date silently writes a festival that ends before it starts -- which no
  // database constraint catches and which isFestivalLive then never matches.
  if (body.start_date !== undefined || body.end_date !== undefined) {
    const existing = await adminRepo.getFestival(festivalId);

    if (!existing) {
      throw new NotFoundError("Festival not found");
    }

    const startDate = body.start_date ?? existing.start_date;
    const endDate = body.end_date ?? existing.end_date;

    if (endDate < startDate) {
      throw new ValidationError("end_date must not be before start_date");
    }
  }

  const festival = await adminRepo.updateFestival(festivalId, body);

  if (!festival) {
    throw new NotFoundError("Festival not found");
  }

  return c.json({ festival }, 200);
});

// DELETE /admin/festivals/:festivalId - Delete a festival
const deleteFestivalRoute = createRoute({
  method: "delete",
  path: "/admin/festivals/{festivalId}",
  tags: ["admin"],
  summary: "Delete a festival (admin)",
  description:
    "Refuses with 409 when attendances, groups or tent visits still reference the festival; archive it instead.",
  request: { params: z.object({ festivalId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Festival deleted successfully",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...errorResponses,
    409: {
      description: "Festival still has dependent data",
      content: {
        "application/json": {
          // Shaped like every other error response: ConflictError serialises
          // as { error: { code, message } }. An earlier draft documented a
          // top-level `blockedBy` that nothing ever sets, so a client reading
          // it to tell the reasons apart only ever saw undefined.
          schema: z.object({
            error: z.object({ code: z.string(), message: z.string() }),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(deleteFestivalRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId } = c.req.valid("param");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const result = await adminRepo.deleteFestival(festivalId);

  if ("blockedBy" in result) {
    // 409 rather than 400: the request is well-formed, the festival's state is
    // what refuses it. The client shows "archive instead".
    const reason = {
      attendances: "existing attendance data",
      groups: "existing groups",
      tent_visits: "existing tent visits",
    }[result.blockedBy];

    throw new ConflictError(`Cannot delete a festival with ${reason}. Archive it instead.`);
  }

  return c.json({ success: true }, 200);
});

// =============================================================================
// Tents
//
// Split in two, following the schema: `/admin/tents` is the global catalogue,
// and `/admin/festivals/{id}/tents` is what one festival serves, with its
// prices. Editing a catalogue tent changes it for every festival using it.
// =============================================================================

// GET /admin/tents - List the tent catalogue
const listTentsRoute = createRoute({
  method: "get",
  path: "/admin/tents",
  tags: ["admin"],
  summary: "List tents (admin)",
  responses: {
    200: {
      description: "Tents retrieved successfully",
      content: { "application/json": { schema: z.object({ tents: z.array(AdminTentSchema) }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listTentsRoute, async (c) => {
  const { supabase } = c.var;
  const adminRepo = new SupabaseAdminRepository(supabase);
  const tents = await adminRepo.listTents();
  return c.json({ tents }, 200);
});

// POST /admin/tents - Create a tent
const createTentRoute = createRoute({
  method: "post",
  path: "/admin/tents",
  tags: ["admin"],
  summary: "Create a tent (admin)",
  request: { body: { content: { "application/json": { schema: CreateAdminTentSchema } } } },
  responses: {
    201: {
      description: "Tent created successfully",
      content: { "application/json": { schema: z.object({ tent: AdminTentSchema }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(createTentRoute, async (c) => {
  const { supabase } = c.var;
  const body = c.req.valid("json");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const tent = await adminRepo.createTent(body);

  return c.json({ tent }, 201);
});

// PATCH /admin/tents/:tentId - Update a tent
const updateTentRoute = createRoute({
  method: "patch",
  path: "/admin/tents/{tentId}",
  tags: ["admin"],
  summary: "Update a tent (admin)",
  description: "Edits the catalogue entry, which changes it for every festival serving this tent.",
  request: {
    params: z.object({ tentId: z.string().uuid() }),
    body: { content: { "application/json": { schema: UpdateAdminTentSchema } } },
  },
  responses: {
    200: {
      description: "Tent updated successfully",
      content: { "application/json": { schema: z.object({ tent: AdminTentSchema }) } },
    },
    ...errorResponses,
    404: {
      description: "Tent not found",
      content: { "application/json": { schema: errorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updateTentRoute, async (c) => {
  const { supabase } = c.var;
  const { tentId } = c.req.valid("param");
  const body = c.req.valid("json");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const tent = await adminRepo.updateTent(tentId, body);

  if (!tent) {
    throw new NotFoundError("Tent not found");
  }

  return c.json({ tent }, 200);
});

// GET /admin/festivals/:festivalId/tents - Tents this festival serves
const listFestivalTentsRoute = createRoute({
  method: "get",
  path: "/admin/festivals/{festivalId}/tents",
  tags: ["admin"],
  summary: "List a festival's tents (admin)",
  request: { params: z.object({ festivalId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Festival tents retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            tents: z.array(AdminFestivalTentSchema),
            stats: AdminFestivalTentStatsSchema,
          }),
        },
      },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listFestivalTentsRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId } = c.req.valid("param");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const tents = await adminRepo.listFestivalTents(festivalId);

  return c.json({ tents, stats: adminRepo.getFestivalTentStats(tents) }, 200);
});

// GET /admin/festivals/:festivalId/tents/available - Catalogue tents not yet served
const listAvailableTentsRoute = createRoute({
  method: "get",
  path: "/admin/festivals/{festivalId}/tents/available",
  tags: ["admin"],
  summary: "List tents available to a festival (admin)",
  request: { params: z.object({ festivalId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Available tents retrieved successfully",
      content: { "application/json": { schema: z.object({ tents: z.array(AdminTentSchema) }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listAvailableTentsRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId } = c.req.valid("param");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const tents = await adminRepo.listAvailableTents(festivalId);

  return c.json({ tents }, 200);
});

// POST /admin/festivals/:festivalId/tents - Add one tent to a festival
const addFestivalTentRoute = createRoute({
  method: "post",
  path: "/admin/festivals/{festivalId}/tents",
  tags: ["admin"],
  summary: "Add a tent to a festival (admin)",
  request: {
    params: z.object({ festivalId: z.string().uuid() }),
    body: { content: { "application/json": { schema: AddAdminFestivalTentSchema } } },
  },
  responses: {
    201: {
      description: "Tent added successfully",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(addFestivalTentRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId } = c.req.valid("param");
  const body = c.req.valid("json");

  const adminRepo = new SupabaseAdminRepository(supabase);
  await adminRepo.addFestivalTent(festivalId, body.tent_id, body.beer_price ?? null);

  return c.json({ success: true }, 201);
});

// POST /admin/festivals/:festivalId/tents/all - Add every remaining tent
const addAllFestivalTentsRoute = createRoute({
  method: "post",
  path: "/admin/festivals/{festivalId}/tents/all",
  tags: ["admin"],
  summary: "Add all available tents to a festival (admin)",
  description: "Adds every catalogue tent the festival does not already serve, at one price.",
  request: {
    params: z.object({ festivalId: z.string().uuid() }),
    body: { content: { "application/json": { schema: AddAllAdminFestivalTentsSchema } } },
  },
  responses: {
    200: {
      description: "Tents added successfully",
      content: { "application/json": { schema: z.object({ added: z.number() }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(addAllFestivalTentsRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId } = c.req.valid("param");
  const body = c.req.valid("json");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const added = await adminRepo.addAllAvailableTents(festivalId, body.beer_price ?? null);

  return c.json({ added }, 200);
});

// POST /admin/festivals/:festivalId/tents/copy - Copy assignments from another festival
const copyFestivalTentsRoute = createRoute({
  method: "post",
  path: "/admin/festivals/{festivalId}/tents/copy",
  tags: ["admin"],
  summary: "Copy tents from another festival (admin)",
  description: "Tents the target already serves are skipped, so an existing price is never lost.",
  request: {
    params: z.object({ festivalId: z.string().uuid() }),
    body: { content: { "application/json": { schema: CopyAdminFestivalTentsSchema } } },
  },
  responses: {
    200: {
      description: "Tents copied successfully",
      content: { "application/json": { schema: z.object({ copied: z.number() }) } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(copyFestivalTentsRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId } = c.req.valid("param");
  const body = c.req.valid("json");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const copied = await adminRepo.copyFestivalTents(festivalId, body);

  return c.json({ copied }, 200);
});

// PATCH /admin/festivals/:festivalId/tents/:tentId - Set a tent's price here
const updateFestivalTentPriceRoute = createRoute({
  method: "patch",
  path: "/admin/festivals/{festivalId}/tents/{tentId}",
  tags: ["admin"],
  summary: "Set a tent's beer price at a festival (admin)",
  description:
    "Writes the euro column, the cents column and the canonical drink_type_prices row together. A null price clears all three.",
  request: {
    params: z.object({ festivalId: z.string().uuid(), tentId: z.string().uuid() }),
    body: { content: { "application/json": { schema: UpdateAdminFestivalTentPriceSchema } } },
  },
  responses: {
    200: {
      description: "Price updated successfully",
      content: { "application/json": { schema: z.object({ tent: AdminFestivalTentSchema }) } },
    },
    ...errorResponses,
    404: {
      description: "Tent is not assigned to this festival",
      content: { "application/json": { schema: errorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updateFestivalTentPriceRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId, tentId } = c.req.valid("param");
  const body = c.req.valid("json");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const tent = await adminRepo.updateFestivalTentPrice(festivalId, tentId, body.beer_price);

  if (!tent) {
    throw new NotFoundError("Tent is not assigned to this festival");
  }

  return c.json({ tent }, 200);
});

// DELETE /admin/festivals/:festivalId/tents/:tentId - Stop serving a tent
const removeFestivalTentRoute = createRoute({
  method: "delete",
  path: "/admin/festivals/{festivalId}/tents/{tentId}",
  tags: ["admin"],
  summary: "Remove a tent from a festival (admin)",
  description: "Refuses with 409 when the tent has visits at this festival.",
  request: {
    params: z.object({ festivalId: z.string().uuid(), tentId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Tent removed successfully",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...errorResponses,
    409: {
      description: "Tent has visits at this festival",
      content: { "application/json": { schema: errorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(removeFestivalTentRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId, tentId } = c.req.valid("param");

  const adminRepo = new SupabaseAdminRepository(supabase);
  const result = await adminRepo.removeFestivalTent(festivalId, tentId);

  if ("blockedBy" in result) {
    throw new ConflictError(
      "Cannot remove a tent people have visited at this festival. Their visit history references it.",
    );
  }

  return c.json({ success: true }, 200);
});

// ===========================================================================
// Wrapped cache
// ===========================================================================

// GET /admin/wrapped-cache - List every cached Wrapped payload
const listWrappedCacheRoute = createRoute({
  method: "get",
  path: "/admin/wrapped-cache",
  tags: ["admin"],
  summary: "List cached Wrapped entries (admin)",
  description:
    "One row per user and festival whose Wrapped has been calculated, newest first. The cached payload itself is not returned. Regeneration lives at POST /wrapped/regenerate.",
  responses: {
    200: {
      description: "Cached Wrapped entries",
      content: {
        "application/json": {
          schema: z.object({ entries: z.array(AdminWrappedCacheEntrySchema) }),
        },
      },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listWrappedCacheRoute, async (c) => {
  const { supabase } = c.var;

  const adminRepo = new SupabaseAdminRepository(supabase);
  const entries = await adminRepo.listWrappedCache();

  return c.json({ entries }, 200);
});

export default app;
