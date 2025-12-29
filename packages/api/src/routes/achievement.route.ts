import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  ListAchievementsQuerySchema,
  ListAchievementsResponseSchema,
  EvaluateAchievementsSchema,
  EvaluateAchievementsResponseSchema,
} from "@prostcounter/shared";
import { SupabaseAchievementRepository } from "../repositories/supabase";
import type { AuthContext } from "../middleware/auth";

// Create router
const app = new OpenAPIHono<AuthContext>();

// GET /achievements - List user's achievements
const listAchievementsRoute = createRoute({
  method: "get",
  path: "/achievements",
  tags: ["achievements"],
  summary: "List user's achievements",
  description: "Returns all achievements unlocked by the user for a festival",
  request: {
    query: ListAchievementsQuerySchema,
  },
  responses: {
    200: {
      description: "Achievements retrieved successfully",
      content: {
        "application/json": {
          schema: ListAchievementsResponseSchema,
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

app.openapi(listAchievementsRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const query = c.req.valid("query");

  const achievementRepo = new SupabaseAchievementRepository(supabase);
  const achievements = await achievementRepo.listUserAchievements(user.id, query);

  return c.json({ data: achievements }, 200);
});

// POST /achievements/evaluate - Trigger achievement evaluation
const evaluateAchievementsRoute = createRoute({
  method: "post",
  path: "/achievements/evaluate",
  tags: ["achievements"],
  summary: "Evaluate achievements",
  description:
    "Manually triggers achievement evaluation for the user. Returns newly unlocked achievements.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: EvaluateAchievementsSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Achievement evaluation completed",
      content: {
        "application/json": {
          schema: EvaluateAchievementsResponseSchema,
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

app.openapi(evaluateAchievementsRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { festivalId } = c.req.valid("json");

  // Call stored procedure to evaluate achievements
  const { data, error } = await supabase.rpc("evaluate_achievements", {
    p_user_id: user.id,
    p_festival_id: festivalId,
  });

  if (error) {
    throw new Error(`Failed to evaluate achievements: ${error.message}`);
  }

  // Fetch the newly unlocked achievements
  const achievementRepo = new SupabaseAchievementRepository(supabase);
  const allAchievements = await achievementRepo.listUserAchievements(user.id, {
    festivalId,
  });

  // Calculate total points
  const totalPoints = await achievementRepo.getTotalPoints(user.id, festivalId);

  // Filter for new achievements (unlocked in last few seconds)
  const now = new Date();
  const newAchievements = allAchievements.filter((achievement) => {
    const unlockedAt = new Date(achievement.unlockedAt);
    const diffMs = now.getTime() - unlockedAt.getTime();
    return diffMs < 5000; // Within last 5 seconds
  });

  return c.json(
    {
      newAchievements,
      totalPoints,
    },
    200
  );
});

export default app;
