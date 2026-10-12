import { z } from "zod";

import { DrinkTypeSchema } from "./consumption.schema";

/** Hours without a log before the lock-screen counter goes stale. */
export const LIVE_ACTIVITY_INACTIVITY_HOURS = 2;

/** Codes, not text: the iOS widget and Android labels localize them. */
export const LiveActivityMessageSchema = z.enum([
  "openAppToSync",
  "newDay",
  "festivalEnded",
  "notLogged",
]);
export type LiveActivityMessage = z.infer<typeof LiveActivityMessageSchema>;

/**
 * The lock-screen surface's content. The Swift `ContentState` in
 * targets/live-activity/_shared and modules/live-activity/ios mirrors these keys.
 */
export const LiveActivityStateSchema = z.object({
  drinkCount: z.number().int().min(0),
  beerCount: z.number().int().min(0),
  tentName: z.string().nullable(),
  lastDrinkType: DrinkTypeSchema,
  lastTentId: z.uuid().nullable(),
  pendingCount: z.number().int().min(0),
  lastLogAt: z.iso.datetime({ offset: true }),
  message: LiveActivityMessageSchema.nullable(),
});
export type LiveActivityState = z.infer<typeof LiveActivityStateSchema>;

/** Fixed for the surface's lifetime (ActivityKit attributes). */
export const LiveActivityAttributesSchema = z.object({
  festivalId: z.uuid(),
  festivalName: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string(),
  apiBaseUrl: z.string(),
});
export type LiveActivityAttributes = z.infer<typeof LiveActivityAttributesSchema>;

export const LiveActivityPlatformSchema = z.enum(["ios", "android"]);
export const ApnsEnvironmentSchema = z.enum(["sandbox", "production"]);

// APNs device tokens are hex; anything else must never reach the request path.
const APNS_TOKEN_PATTERN = /^[0-9a-f]{64,256}$/i;

export const RegisterLiveActivityTokenSchema = z
  .object({
    platform: LiveActivityPlatformSchema,
    token: z.string().min(1).max(512),
    apnsEnvironment: ApnsEnvironmentSchema.nullable(),
    festivalId: z.uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((value) => value.platform === "android" || value.apnsEnvironment !== null, {
    message: "apnsEnvironment is required for iOS",
    path: ["apnsEnvironment"],
  })
  .refine((value) => value.platform === "android" || APNS_TOKEN_PATTERN.test(value.token), {
    message: "iOS token must be hex",
    path: ["token"],
  });
export type RegisterLiveActivityTokenInput = z.infer<typeof RegisterLiveActivityTokenSchema>;

export const DeleteLiveActivityTokenSchema = z.object({
  token: z.string().min(1).max(512),
});
export type DeleteLiveActivityTokenInput = z.infer<typeof DeleteLiveActivityTokenSchema>;

export const LiveActivityTokenResponseSchema = z.object({
  success: z.boolean(),
});
