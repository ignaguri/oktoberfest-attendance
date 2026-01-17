import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { ActivityFeedItem } from "@prostcounter/shared";
import {
  GetActivityFeedQuerySchema,
  GetActivityFeedResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";

// Create router
const app = new OpenAPIHono<AuthContext>();

// GET /activity-feed - Get activity feed
const getActivityFeedRoute = createRoute({
  method: "get",
  path: "/activity-feed",
  tags: ["activity-feed"],
  summary: "Get activity feed",
  description:
    "Returns activity feed items for a festival with cursor-based pagination",
  request: {
    query: GetActivityFeedQuerySchema,
  },
  responses: {
    200: {
      description: "Activity feed retrieved successfully",
      content: {
        "application/json": {
          schema: GetActivityFeedResponseSchema,
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

app.openapi(getActivityFeedRoute, async (c) => {
  const { supabase } = c.var;
  const { festivalId, cursor, limit } = c.req.valid("query");

  // Build query to fetch activity feed with cursor-based pagination
  let query = supabase
    .from("activity_feed")
    .select("*")
    .eq("festival_id", festivalId)
    .order("activity_time", { ascending: false })
    .limit(limit + 1); // Fetch one extra to determine if there's more

  // Add cursor-based filtering if provided
  if (cursor) {
    query = query.lt("activity_time", cursor);
  }

  const { data: activities, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch activity feed: ${error.message}`);
  }

  // Determine if there are more results
  const hasMore = activities.length > limit;
  const resultActivities = hasMore ? activities.slice(0, limit) : activities;

  // Get the next cursor (last item's activity_time)
  const nextCursor =
    hasMore && resultActivities.length > 0
      ? resultActivities[resultActivities.length - 1].activity_time
      : null;

  return c.json(
    {
      activities: resultActivities as ActivityFeedItem[],
      nextCursor,
      hasMore,
    },
    200,
  );
});

export default app;
