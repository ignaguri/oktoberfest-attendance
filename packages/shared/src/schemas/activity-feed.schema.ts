import { z } from "zod";

/**
 * Activity type enum
 */
export const ActivityTypeSchema = z.enum([
  "beer_count_update",
  "tent_checkin",
  "photo_upload",
  "group_join",
  "achievement_unlock",
]);

export type ActivityType = z.infer<typeof ActivityTypeSchema>;

/**
 * Activity feed item
 */
export const ActivityFeedItemSchema = z.object({
  user_id: z.string().uuid(),
  festival_id: z.string().uuid(),
  activity_type: ActivityTypeSchema,
  activity_data: z.record(z.string(), z.unknown()),
  activity_time: z.string(),
  username: z.string().nullable(),
  full_name: z.string().nullable(),
  avatar_url: z.string().nullable(),
});

export type ActivityFeedItem = z.infer<typeof ActivityFeedItemSchema>;

/**
 * Activity feed query
 * GET /api/v1/activity-feed
 */
export const GetActivityFeedQuerySchema = z.object({
  festivalId: z.string().uuid({ message: "Invalid festival ID" }),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
});

export type GetActivityFeedQuery = z.infer<typeof GetActivityFeedQuerySchema>;

/**
 * Activity feed response
 */
export const GetActivityFeedResponseSchema = z.object({
  activities: z.array(ActivityFeedItemSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type GetActivityFeedResponse = z.infer<
  typeof GetActivityFeedResponseSchema
>;
