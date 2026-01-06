import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  ListAchievementsQuerySchema,
  ListAchievementsResponseSchema,
  EvaluateAchievementsSchema,
  EvaluateAchievementsResponseSchema,
  GetAchievementsWithProgressResponseSchema,
  GetAchievementLeaderboardResponseSchema,
  ListAvailableAchievementsResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";
import type {
  AchievementWithProgress,
  AchievementStats,
  AchievementLeaderboardEntry,
  AvailableAchievement,
} from "@prostcounter/shared";

import { SupabaseAchievementRepository } from "../repositories/supabase";

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
  const achievements = await achievementRepo.listUserAchievements(
    user.id,
    query,
  );

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
    200,
  );
});

// GET /achievements/with-progress - Get all achievements with progress info
const getAchievementsWithProgressRoute = createRoute({
  method: "get",
  path: "/achievements/with-progress",
  tags: ["achievements"],
  summary: "Get all achievements with progress",
  description:
    "Returns all achievements (locked and unlocked) with user progress for a festival",
  request: {
    query: ListAchievementsQuerySchema,
  },
  responses: {
    200: {
      description: "Achievements with progress retrieved successfully",
      content: {
        "application/json": {
          schema: GetAchievementsWithProgressResponseSchema,
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

app.openapi(getAchievementsWithProgressRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const query = c.req.valid("query");

  // Call the database function that returns all achievements with progress
  const { data, error } = await supabase.rpc("get_user_achievements", {
    p_user_id: user.id,
    p_festival_id: query.festivalId,
  });

  if (error) {
    throw new Error(`Failed to fetch achievements: ${error.message}`);
  }

  // Map database result to API response format
  const achievements: AchievementWithProgress[] = (data || []).map(
    (achievement: any) => ({
      id: achievement.achievement_id,
      name: achievement.name,
      description: achievement.description,
      category: achievement.category,
      icon: achievement.icon,
      points: achievement.points,
      rarity: achievement.rarity,
      conditions: {},
      is_active: true,
      created_at: "",
      updated_at: "",
      is_unlocked: achievement.is_unlocked,
      unlocked_at: achievement.unlocked_at,
      user_progress: achievement.current_progress
        ? {
            current_value:
              (achievement.current_progress as any)?.current_value || 0,
            target_value:
              (achievement.current_progress as any)?.target_value || 1,
            percentage: (achievement.current_progress as any)?.percentage || 0,
            last_updated: new Date().toISOString(),
          }
        : {
            current_value: 0,
            target_value: 1,
            percentage: 0,
            last_updated: new Date().toISOString(),
          },
    }),
  );

  // Calculate stats
  const stats: AchievementStats = {
    total_achievements: achievements.length,
    unlocked_achievements: achievements.filter((a) => a.is_unlocked).length,
    total_points: achievements
      .filter((a) => a.is_unlocked)
      .reduce((sum, a) => sum + a.points, 0),
    breakdown_by_category: {
      consumption: { total: 0, unlocked: 0, points: 0 },
      attendance: { total: 0, unlocked: 0, points: 0 },
      explorer: { total: 0, unlocked: 0, points: 0 },
      social: { total: 0, unlocked: 0, points: 0 },
      competitive: { total: 0, unlocked: 0, points: 0 },
      special: { total: 0, unlocked: 0, points: 0 },
    },
    breakdown_by_rarity: {
      common: { total: 0, unlocked: 0, points: 0 },
      rare: { total: 0, unlocked: 0, points: 0 },
      epic: { total: 0, unlocked: 0, points: 0 },
      legendary: { total: 0, unlocked: 0, points: 0 },
    },
  };

  achievements.forEach((achievement) => {
    const category = achievement.category;
    const rarity = achievement.rarity;

    stats.breakdown_by_category[category].total++;
    stats.breakdown_by_rarity[rarity].total++;

    if (achievement.is_unlocked) {
      stats.breakdown_by_category[category].unlocked++;
      stats.breakdown_by_category[category].points += achievement.points;
      stats.breakdown_by_rarity[rarity].unlocked++;
      stats.breakdown_by_rarity[rarity].points += achievement.points;
    }
  });

  return c.json({ data: achievements, stats }, 200);
});

// GET /achievements/leaderboard - Get achievement leaderboard
const getAchievementLeaderboardRoute = createRoute({
  method: "get",
  path: "/achievements/leaderboard",
  tags: ["achievements"],
  summary: "Get achievement leaderboard",
  description: "Returns the achievement leaderboard for a festival",
  request: {
    query: ListAchievementsQuerySchema,
  },
  responses: {
    200: {
      description: "Leaderboard retrieved successfully",
      content: {
        "application/json": {
          schema: GetAchievementLeaderboardResponseSchema,
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

app.openapi(getAchievementLeaderboardRoute, async (c) => {
  const supabase = c.var.supabase;
  const query = c.req.valid("query");

  const { data, error } = await supabase.rpc("get_achievement_leaderboard", {
    p_festival_id: query.festivalId,
  });

  if (error) {
    throw new Error(`Failed to fetch leaderboard: ${error.message}`);
  }

  const leaderboard: AchievementLeaderboardEntry[] = (data || []).map(
    (entry: any) => ({
      user_id: entry.user_id,
      username: entry.username,
      full_name: entry.full_name,
      avatar_url: entry.avatar_url,
      total_achievements: entry.total_achievements,
      total_points: entry.total_points,
    }),
  );

  return c.json({ data: leaderboard }, 200);
});

// GET /achievements/available - Get all available achievements
const listAvailableAchievementsRoute = createRoute({
  method: "get",
  path: "/achievements/available",
  tags: ["achievements"],
  summary: "List all available achievements",
  description: "Returns all active achievements that can be unlocked",
  responses: {
    200: {
      description: "Available achievements retrieved successfully",
      content: {
        "application/json": {
          schema: ListAvailableAchievementsResponseSchema,
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

app.openapi(listAvailableAchievementsRoute, async (c) => {
  const supabase = c.var.supabase;

  const { data, error } = await supabase
    .from("achievements")
    .select("id, name, description, category, icon, points, rarity, is_active")
    .eq("is_active", true)
    .order("category")
    .order("points");

  if (error) {
    throw new Error(`Failed to fetch achievements: ${error.message}`);
  }

  const achievements: AvailableAchievement[] = (data || []).map(
    (achievement: any) => ({
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      category: achievement.category,
      icon: achievement.icon,
      points: achievement.points,
      rarity: achievement.rarity,
      is_active: achievement.is_active,
    }),
  );

  return c.json({ data: achievements }, 200);
});

export default app;
