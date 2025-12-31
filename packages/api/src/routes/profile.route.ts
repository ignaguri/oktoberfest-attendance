import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  GetProfileShortResponseSchema,
  UpdateProfileSchema,
  UpdateProfileResponseSchema,
  DeleteProfileResponseSchema,
  GetTutorialStatusResponseSchema,
  UpdateTutorialStatusResponseSchema,
  GetMissingProfileFieldsResponseSchema,
  GetHighlightsResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";

import { SupabaseProfileRepository } from "../repositories/supabase";

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

app.openapi(getProfileRoute, async (c) => {
  const { user, supabase } = c.var;

  const profileRepo = new SupabaseProfileRepository(supabase);
  const profile = await profileRepo.getProfileShort(user.id, user.email);

  return c.json({ profile }, 200);
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

app.openapi(updateProfileRoute, async (c) => {
  const { user, supabase } = c.var;
  const input = c.req.valid("json");

  const profileRepo = new SupabaseProfileRepository(supabase);
  const profile = await profileRepo.updateProfile(user.id, input);

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

app.openapi(deleteProfileRoute, async (c) => {
  const { user, supabase } = c.var;

  const profileRepo = new SupabaseProfileRepository(supabase);
  await profileRepo.deleteProfile(user.id);

  return c.json(
    { success: true, message: "Account deleted successfully" },
    200,
  );
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
  description:
    "Returns statistics and highlights for the user's festival attendance",
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

app.openapi(getHighlightsRoute, async (c) => {
  const { user, supabase } = c.var;
  const { festivalId } = c.req.valid("query");

  const profileRepo = new SupabaseProfileRepository(supabase);
  const highlights = await profileRepo.getHighlights(user.id, festivalId);

  return c.json({ highlights }, 200);
});

export default app;
