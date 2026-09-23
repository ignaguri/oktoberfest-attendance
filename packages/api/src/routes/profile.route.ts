import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  ConfirmAvatarUploadResponseSchema,
  ConfirmAvatarUploadSchema,
  DeleteProfileResponseSchema,
  GetAvatarUploadUrlQuerySchema,
  GetAvatarUploadUrlResponseSchema,
  GetHighlightsResponseSchema,
  GetMissingProfileFieldsResponseSchema,
  GetProfileDaysResponseSchema,
  GetProfileDetailQuerySchema,
  GetProfileDetailResponseSchema,
  GetProfileShortResponseSchema,
  GetPublicProfileQuerySchema,
  GetPublicProfileResponseSchema,
  GetTutorialStatusResponseSchema,
  UpdateProfileResponseSchema,
  UpdateProfileSchema,
  UpdateTutorialStatusResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";
import { NotFoundError } from "../middleware/error";
import { SupabaseProfileRepository } from "../repositories/supabase";
import { evaluateAfterWrite } from "../services/evaluate-after-write";
import { deleteAuthUser } from "../utils/admin-client";
import { ApiErrorSchema } from "../lib/error-response";

// Create router
const app = new OpenAPIHono<AuthContext>();

// GET /profile - Get current user's profile
const getProfileRoute = createRoute({
  method: "get",
  path: "/profile",
  tags: ["profile"],
  summary: "Get current user's profile",
  description: "Returns the profile data for the authenticated user",
  responses: {
    200: {
      description: "Profile retrieved successfully",
      content: {
        "application/json": {
          schema: GetProfileShortResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getProfileRoute, async (c) => {
  const { user, supabase } = c.var;

  const profileRepo = new SupabaseProfileRepository(supabase);
  const profile = await profileRepo.getProfileShort(user.id, user.email);

  return c.json({ profile }, 200);
});

// GET /profiles/:userId - Get public profile of a user
const getPublicProfileRoute = createRoute({
  method: "get",
  path: "/profiles/{userId}",
  tags: ["profile"],
  summary: "Get public profile of a user",
  description:
    "Returns public profile information for any user. Optionally includes festival stats when festivalId is provided.",
  request: {
    params: z.object({
      userId: z.string().uuid({ message: "Invalid user ID" }),
    }),
    query: GetPublicProfileQuerySchema,
  },
  responses: {
    200: {
      description: "Profile retrieved successfully",
      content: {
        "application/json": {
          schema: GetPublicProfileResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getPublicProfileRoute, async (c) => {
  const { supabase, user } = c.var;
  const { userId } = c.req.valid("param");
  const { festivalId } = c.req.valid("query");

  const profileRepo = new SupabaseProfileRepository(supabase);

  try {
    const profile = await profileRepo.getPublicProfile(userId, festivalId, user?.id);
    return c.json({ profile }, 200);
  } catch {
    throw new NotFoundError("User not found");
  }
});

// GET /profiles/:userId/detail - Full profile page payload
const getProfileDetailRoute = createRoute({
  method: "get",
  path: "/profiles/{userId}/detail",
  tags: ["profile"],
  summary: "Get the full profile page payload for a user",
  description:
    "Returns identity, festival stats, shared group names, favourite tent and attendance history. History and favourite tent are visible only to a friend or a group mate; RLS returns them empty to anyone else.",
  request: {
    params: z.object({
      userId: z.string().uuid({ message: "Invalid user ID" }),
    }),
    query: GetProfileDetailQuerySchema,
  },
  responses: {
    200: {
      description: "Profile detail retrieved successfully",
      content: { "application/json": { schema: GetProfileDetailResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ApiErrorSchema } },
    },
    404: {
      description: "User not found",
      content: { "application/json": { schema: ApiErrorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getProfileDetailRoute, async (c) => {
  const { supabase, user } = c.var;
  const { userId } = c.req.valid("param");
  const { festivalId } = c.req.valid("query");

  const profileRepo = new SupabaseProfileRepository(supabase);

  // No catch-all: getProfileDetail throws NotFoundError when the profile is
  // missing and DatabaseError when a read fails, so a transient database
  // problem surfaces as a 500 instead of "User not found".
  const profile = await profileRepo.getProfileDetail(userId, festivalId, user?.id);

  return c.json({ profile }, 200);
});

// GET /profiles/:userId/festivals/:festivalId/days - Lazy day breakdown
const getProfileDaysRoute = createRoute({
  method: "get",
  path: "/profiles/{userId}/festivals/{festivalId}/days",
  tags: ["profile"],
  summary: "Get a user's day-by-day breakdown for one festival",
  description:
    "Returns one row per day attended, with drink count and tents. Empty for a viewer who is neither a friend nor a group mate.",
  request: {
    params: z.object({
      userId: z.string().uuid({ message: "Invalid user ID" }),
      festivalId: z.string().uuid({ message: "Invalid festival ID" }),
    }),
  },
  responses: {
    200: {
      description: "Days retrieved successfully",
      content: { "application/json": { schema: GetProfileDaysResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ApiErrorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getProfileDaysRoute, async (c) => {
  const { supabase } = c.var;
  const { userId, festivalId } = c.req.valid("param");

  const profileRepo = new SupabaseProfileRepository(supabase);
  const days = await profileRepo.listProfileDays(userId, festivalId);

  return c.json({ days }, 200);
});

// PUT /profile - Update current user's profile
const updateProfileRoute = createRoute({
  method: "put",
  path: "/profile",
  tags: ["profile"],
  summary: "Update current user's profile",
  description: "Updates the profile data for the authenticated user",
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdateProfileSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Profile updated successfully",
      content: {
        "application/json": {
          schema: UpdateProfileResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
    409: {
      description: "The requested username already belongs to another account",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updateProfileRoute, async (c) => {
  const { user, supabase } = c.var;
  const input = c.req.valid("json");

  const profileRepo = new SupabaseProfileRepository(supabase);
  const profile = await profileRepo.updateProfile(user.id, input);

  // Evaluate-only: the unlock reaches the client through the outbox, not this
  // response. Awaited so the outbox row exists before the client's next read.
  await evaluateAfterWrite(supabase, user.id, null, "PUT /profile");

  return c.json({ profile }, 200);
});

// DELETE /profile - Delete current user's account
const deleteProfileRoute = createRoute({
  method: "delete",
  path: "/profile",
  tags: ["profile"],
  summary: "Delete current user's account",
  description: "Permanently deletes the user's account and all associated data",
  responses: {
    200: {
      description: "Account deleted successfully",
      content: {
        "application/json": {
          schema: DeleteProfileResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(deleteProfileRoute, async (c) => {
  const { user, supabase } = c.var;

  // First delete all user data from the database
  const profileRepo = new SupabaseProfileRepository(supabase);
  await profileRepo.deleteProfile(user.id);

  // Then delete the auth user using service role
  await deleteAuthUser(user.id);

  return c.json({ success: true, message: "Account deleted successfully" }, 200);
});

// GET /profile/tutorial - Get tutorial status
const getTutorialStatusRoute = createRoute({
  method: "get",
  path: "/profile/tutorial",
  tags: ["profile"],
  summary: "Get tutorial status",
  description: "Returns the tutorial completion status for the user",
  responses: {
    200: {
      description: "Tutorial status retrieved successfully",
      content: {
        "application/json": {
          schema: GetTutorialStatusResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getTutorialStatusRoute, async (c) => {
  const { user, supabase } = c.var;

  const profileRepo = new SupabaseProfileRepository(supabase);
  const status = await profileRepo.getTutorialStatus(user.id);

  return c.json({ status }, 200);
});

// POST /profile/tutorial/complete - Mark tutorial as complete
const completeTutorialRoute = createRoute({
  method: "post",
  path: "/profile/tutorial/complete",
  tags: ["profile"],
  summary: "Complete tutorial",
  description: "Marks the tutorial as completed for the user",
  responses: {
    200: {
      description: "Tutorial marked as complete",
      content: {
        "application/json": {
          schema: UpdateTutorialStatusResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(completeTutorialRoute, async (c) => {
  const { user, supabase } = c.var;

  const profileRepo = new SupabaseProfileRepository(supabase);
  await profileRepo.completeTutorial(user.id);

  return c.json({ success: true }, 200);
});

// POST /profile/tutorial/reset - Reset tutorial
const resetTutorialRoute = createRoute({
  method: "post",
  path: "/profile/tutorial/reset",
  tags: ["profile"],
  summary: "Reset tutorial",
  description: "Resets the tutorial status for the user",
  responses: {
    200: {
      description: "Tutorial reset successfully",
      content: {
        "application/json": {
          schema: UpdateTutorialStatusResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(resetTutorialRoute, async (c) => {
  const { user, supabase } = c.var;

  const profileRepo = new SupabaseProfileRepository(supabase);
  await profileRepo.resetTutorial(user.id);

  return c.json({ success: true }, 200);
});

// GET /profile/missing-fields - Get missing profile fields
const getMissingFieldsRoute = createRoute({
  method: "get",
  path: "/profile/missing-fields",
  tags: ["profile"],
  summary: "Get missing profile fields",
  description: "Returns which profile fields are not yet filled in",
  responses: {
    200: {
      description: "Missing fields retrieved successfully",
      content: {
        "application/json": {
          schema: GetMissingProfileFieldsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getMissingFieldsRoute, async (c) => {
  const { user, supabase } = c.var;

  const profileRepo = new SupabaseProfileRepository(supabase);
  const result = await profileRepo.getMissingProfileFields(user.id);

  return c.json(result, 200);
});

// GET /profile/highlights - Get user highlights/stats
const getHighlightsRoute = createRoute({
  method: "get",
  path: "/profile/highlights",
  tags: ["profile"],
  summary: "Get user highlights",
  description: "Returns statistics and highlights for the user's festival attendance",
  request: {
    query: z.object({
      festivalId: z.string().uuid({ message: "Invalid festival ID" }),
    }),
  },
  responses: {
    200: {
      description: "Highlights retrieved successfully",
      content: {
        "application/json": {
          schema: GetHighlightsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getHighlightsRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId } = c.req.valid("query");

  const profileRepo = new SupabaseProfileRepository(supabase);
  const highlights = await profileRepo.getHighlights(user.id, festivalId);

  return c.json({ highlights }, 200);
});

// GET /profile/avatar/upload-url - Get signed upload URL for avatar
const getAvatarUploadUrlRoute = createRoute({
  method: "get",
  path: "/profile/avatar/upload-url",
  tags: ["profile"],
  summary: "Get signed upload URL for avatar",
  description:
    "Returns a signed upload URL for uploading a user avatar. Client uploads directly to storage.",
  request: {
    query: GetAvatarUploadUrlQuerySchema,
  },
  responses: {
    200: {
      description: "Upload URL generated successfully",
      content: {
        "application/json": {
          schema: GetAvatarUploadUrlResponseSchema,
        },
      },
    },
    400: {
      description: "Validation error",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getAvatarUploadUrlRoute, async (c) => {
  const { user, supabase } = c.var;
  const query = c.req.valid("query");

  const profileRepo = new SupabaseProfileRepository(supabase);
  const result = await profileRepo.getAvatarUploadUrl(user.id, query);

  return c.json(result, 200);
});

// POST /profile/avatar/confirm - Confirm avatar upload
const confirmAvatarUploadRoute = createRoute({
  method: "post",
  path: "/profile/avatar/confirm",
  tags: ["profile"],
  summary: "Confirm avatar upload",
  description:
    "Confirms that an avatar was successfully uploaded to storage and updates the user's profile.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ConfirmAvatarUploadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Avatar confirmed successfully",
      content: {
        "application/json": {
          schema: ConfirmAvatarUploadResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: ApiErrorSchema,
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(confirmAvatarUploadRoute, async (c) => {
  const { user, supabase } = c.var;
  const { fileName } = c.req.valid("json");

  const profileRepo = new SupabaseProfileRepository(supabase);
  const confirmedFileName = await profileRepo.confirmAvatarUpload(user.id, fileName);

  // Evaluate-only: the unlock reaches the client through the outbox, not this
  // response. Awaited so the outbox row exists before the client's next read.
  await evaluateAfterWrite(supabase, user.id, null, "POST /profile/avatar/confirm");

  return c.json({ success: true, fileName: confirmedFileName }, 200);
});

export default app;
