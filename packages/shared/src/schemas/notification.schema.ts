import { z } from "zod";

/**
 * Register FCM token request
 * POST /api/v1/notifications/token
 */
export const RegisterFCMTokenSchema = z.object({
  token: z.string().min(1, "FCM token is required"),
});

export type RegisterFCMTokenInput = z.infer<typeof RegisterFCMTokenSchema>;

/**
 * Register FCM token response
 */
export const RegisterFCMTokenResponseSchema = z.object({
  success: z.boolean(),
  novuRegistered: z.boolean().optional(),
  error: z.string().optional(),
});

export type RegisterFCMTokenResponse = z.infer<
  typeof RegisterFCMTokenResponseSchema
>;

/**
 * Subscribe user to Novu request
 * POST /api/v1/notifications/subscribe
 *
 * Note: We use plain strings here instead of z.email()/z.url() because
 * the OpenAPI validation runs before Zod transforms, rejecting empty strings.
 * The Novu API handles its own validation for email/url formats.
 */
export const SubscribeUserSchema = z.object({
  email: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatar: z.string().optional(),
});

export type SubscribeUserInput = z.infer<typeof SubscribeUserSchema>;

/**
 * Subscribe user response
 */
export const SubscribeUserResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

export type SubscribeUserResponse = z.infer<typeof SubscribeUserResponseSchema>;

/**
 * User notification preferences
 */
export const NotificationPreferencesSchema = z.object({
  userId: z.uuid().nullable(),
  pushEnabled: z.boolean().nullable(),
  groupJoinEnabled: z.boolean().nullable(),
  checkinEnabled: z.boolean().nullable(),
  remindersEnabled: z.boolean().nullable(),
  achievementNotificationsEnabled: z.boolean().nullable(),
  groupNotificationsEnabled: z.boolean().nullable(),
  createdAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime().nullable(),
});

export type NotificationPreferences = z.infer<
  typeof NotificationPreferencesSchema
>;

/**
 * Update notification preferences request
 * PUT /api/v1/notifications/preferences
 */
export const UpdateNotificationPreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  groupJoinEnabled: z.boolean().optional(),
  checkinEnabled: z.boolean().optional(),
  remindersEnabled: z.boolean().optional(),
  achievementNotificationsEnabled: z.boolean().optional(),
  groupNotificationsEnabled: z.boolean().optional(),
});

export type UpdateNotificationPreferencesInput = z.infer<
  typeof UpdateNotificationPreferencesSchema
>;
