import { z } from "zod";

/**
 * Location point schema
 */
export const LocationPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(), // Accuracy in meters
  timestamp: z.string().datetime(),
});

export type LocationPoint = z.infer<typeof LocationPointSchema>;

/**
 * Location session schema
 */
export const LocationSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  festivalId: z.string().uuid(),
  isActive: z.boolean(),
  startedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LocationSession = z.infer<typeof LocationSessionSchema>;

/**
 * Location session with member info
 */
export const LocationSessionMemberSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  groupId: z.string().uuid(),
  groupName: z.string(),
  lastLocation: LocationPointSchema.nullable(),
  distance: z.number().nullable(), // Distance in meters (if calculated)
});

export type LocationSessionMember = z.infer<typeof LocationSessionMemberSchema>;

/**
 * Start location session request
 * POST /api/v1/location/sessions
 */
export const StartLocationSessionSchema = z.object({
  festivalId: z.string().uuid("Invalid festival ID"),
  durationMinutes: z.number().int().min(5).max(480).optional().default(120), // 2 hours default, max 8 hours
  initialLocation: LocationPointSchema.optional(),
});

export type StartLocationSessionInput = z.infer<typeof StartLocationSessionSchema>;

/**
 * Start location session response
 */
export const StartLocationSessionResponseSchema = z.object({
  session: LocationSessionSchema,
});

export type StartLocationSessionResponse = z.infer<typeof StartLocationSessionResponseSchema>;

/**
 * Stop location session request
 * DELETE /api/v1/location/sessions/:id
 */
export const StopLocationSessionSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
});

export type StopLocationSessionInput = z.infer<typeof StopLocationSessionSchema>;

/**
 * Stop location session response
 */
export const StopLocationSessionResponseSchema = z.object({
  success: z.boolean(),
  session: LocationSessionSchema,
});

export type StopLocationSessionResponse = z.infer<typeof StopLocationSessionResponseSchema>;

/**
 * Update location request
 * POST /api/v1/location/sessions/:id/update
 */
export const UpdateLocationSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  location: LocationPointSchema,
});

export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>;

/**
 * Update location response
 */
export const UpdateLocationResponseSchema = z.object({
  success: z.boolean(),
});

export type UpdateLocationResponse = z.infer<typeof UpdateLocationResponseSchema>;

/**
 * Get nearby members query
 * GET /api/v1/location/nearby
 */
export const GetNearbyMembersQuerySchema = z.object({
  festivalId: z.string().uuid("Invalid festival ID"),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().int().min(100).max(5000).optional().default(1000), // 1km default
  groupId: z.string().uuid("Invalid group ID").optional(), // Filter to specific group
});

export type GetNearbyMembersQuery = z.infer<typeof GetNearbyMembersQuerySchema>;

/**
 * Get nearby members response
 */
export const GetNearbyMembersResponseSchema = z.object({
  members: z.array(LocationSessionMemberSchema),
  userLocation: LocationPointSchema,
  radiusMeters: z.number().int(),
});

export type GetNearbyMembersResponse = z.infer<typeof GetNearbyMembersResponseSchema>;

/**
 * Get active sessions for user
 * GET /api/v1/location/sessions
 */
export const GetLocationSessionsQuerySchema = z.object({
  festivalId: z.string().uuid("Invalid festival ID").optional(),
  activeOnly: z.coerce.boolean().optional().default(true),
});

export type GetLocationSessionsQuery = z.infer<typeof GetLocationSessionsQuerySchema>;

/**
 * Get location sessions response
 */
export const GetLocationSessionsResponseSchema = z.object({
  sessions: z.array(LocationSessionSchema),
});

export type GetLocationSessionsResponse = z.infer<typeof GetLocationSessionsResponseSchema>;
