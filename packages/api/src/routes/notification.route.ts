import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  NotificationPreferencesSchema,
  RegisterFCMTokenResponseSchema,
  RegisterFCMTokenSchema,
  SubscribeUserResponseSchema,
  SubscribeUserSchema,
  UpdateNotificationPreferencesSchema,
} from "@prostcounter/shared";

import { logger } from "../lib/logger";
import type { AuthContext } from "../middleware/auth";
import { NotificationService } from "../services/notification.service";

// Create router
const app = new OpenAPIHono<AuthContext>();

// POST /notifications/token - Register FCM token
const registerTokenRoute = createRoute({
  method: "post",
  path: "/notifications/token",
  tags: ["notifications"],
  summary: "Register FCM device token",
  description:
    "Registers a Firebase Cloud Messaging device token with Novu for push notifications",
  request: {
    body: {
      content: {
        "application/json": {
          schema: RegisterFCMTokenSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "FCM token registered successfully",
      content: {
        "application/json": {
          schema: RegisterFCMTokenResponseSchema,
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

app.openapi(registerTokenRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { token } = c.req.valid("json");

  logger.debug(
    {
      userId: user.id,
      tokenLength: token?.length,
      tokenPrefix: token?.substring(0, 30),
    },
    "Register token request",
  );

  const novuApiKey = process.env.NOVU_API_KEY!;
  const notificationService = new NotificationService(supabase, novuApiKey);

  // Auto-detect token type (Expo push token or FCM token)
  const result = await notificationService.registerPushToken(user.id, token);

  logger.debug(result, "Register token result");
  return c.json(result, 200);
});

// POST /notifications/subscribe - Subscribe user to Novu
const subscribeUserRoute = createRoute({
  method: "post",
  path: "/notifications/subscribe",
  tags: ["notifications"],
  summary: "Subscribe user to Novu",
  description:
    "Subscribes a user to Novu notification system with their profile data",
  request: {
    body: {
      content: {
        "application/json": {
          schema: SubscribeUserSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "User subscribed successfully",
      content: {
        "application/json": {
          schema: SubscribeUserResponseSchema,
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

app.openapi(subscribeUserRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { email, firstName, lastName, avatar } = c.req.valid("json");

  logger.debug(
    {
      userId: user.id,
      email: email || "(empty)",
      firstName: firstName || "(empty)",
      lastName: lastName || "(empty)",
      avatar: avatar ? "present" : "(empty)",
    },
    "Subscribe request",
  );

  const novuApiKey = process.env.NOVU_API_KEY!;
  const notificationService = new NotificationService(supabase, novuApiKey);

  const result = await notificationService.subscribeUser(
    user.id,
    email,
    firstName,
    lastName,
    avatar,
  );

  logger.debug(result, "Subscribe result");
  return c.json(result, 200);
});

// GET /notifications/preferences - Get user notification preferences
const getPreferencesRoute = createRoute({
  method: "get",
  path: "/notifications/preferences",
  tags: ["notifications"],
  summary: "Get notification preferences",
  description: "Retrieves the user's notification preferences",
  responses: {
    200: {
      description: "Preferences retrieved successfully",
      content: {
        "application/json": {
          schema: NotificationPreferencesSchema.nullable(),
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

app.openapi(getPreferencesRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;

  const novuApiKey = process.env.NOVU_API_KEY!;
  const notificationService = new NotificationService(supabase, novuApiKey);

  const preferences = await notificationService.getUserNotificationPreferences(
    user.id,
  );

  if (!preferences) {
    return c.json(null, 200);
  }

  // Map database columns to camelCase schema
  return c.json(
    {
      userId: preferences.user_id,
      pushEnabled: preferences.push_enabled,
      groupJoinEnabled: preferences.group_join_enabled,
      checkinEnabled: preferences.checkin_enabled,
      remindersEnabled: preferences.reminders_enabled,
      achievementNotificationsEnabled:
        preferences.achievement_notifications_enabled,
      groupNotificationsEnabled: preferences.group_notifications_enabled,
      createdAt: preferences.created_at,
      updatedAt: preferences.updated_at,
    },
    200,
  );
});

// PUT /notifications/preferences - Update notification preferences
const updatePreferencesRoute = createRoute({
  method: "put",
  path: "/notifications/preferences",
  tags: ["notifications"],
  summary: "Update notification preferences",
  description: "Updates the user's notification preferences",
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdateNotificationPreferencesSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Preferences updated successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
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
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(updatePreferencesRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const preferences = c.req.valid("json");

  const novuApiKey = process.env.NOVU_API_KEY!;
  const notificationService = new NotificationService(supabase, novuApiKey);

  const success = await notificationService.updateUserNotificationPreferences(
    user.id,
    preferences,
  );

  return c.json({ success }, 200);
});

export default app;
