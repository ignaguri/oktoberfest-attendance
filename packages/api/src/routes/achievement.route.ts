import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AchievementLeaderboardEntry, AvailableAchievement } from "@prostcounter/shared";
import {
  EvaluateAchievementsResponseSchema,
  EvaluateAchievementsSchema,
  GetAchievementLeaderboardResponseSchema,
  GetAchievementsWithProgressResponseSchema,
  GetPendingUnlocksResponseSchema,
  ListAchievementsQuerySchema,
  ListAchievementsResponseSchema,
  ListAvailableAchievementsResponseSchema,
  MarkUnlocksSeenResponseSchema,
  MarkUnlocksSeenSchema,
} from "@prostcounter/shared";
import { buildStats, evaluate } from "@prostcounter/shared/achievements";

import type { AuthContext } from "../middleware/auth";
import { AchievementMetricsRepository } from "../repositories/supabase/achievement-metrics.repository";
import { SupabaseAchievementRepository } from "../repositories/supabase";
import { buildRecentUnlocks, buildSeriesCards } from "../services/achievement-cards";

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
  const { data: _data, error } = await supabase.rpc("evaluate_user_achievements", {
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
  description: "Returns all achievements (locked and unlocked) with user progress for a festival",
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

  const metricsRepo = new AchievementMetricsRepository(supabase);

  // The definition tables already describe every card; the database answers
  // which slugs this user holds and when they landed, plus the raw metric
  // values the rail needs. currentTier still comes from the unlock rows, so it
  // cannot contradict the per-rung unlocked flags — see buildCardProgress for
  // why the metrics-derived nextTarget is deliberately ignored.
  //
  // Calls getMetrics + evaluate() directly instead of going through
  // AchievementService.getProgress(), which would also issue its own
  // getHeldSlugs() query — a second, redundant read of the exact same
  // user_achievements rows unlockDates below already fetched, whose only
  // output (evaluation.unlocked) this route never uses.
  const [unlockDates, metrics] = await Promise.all([
    metricsRepo.getHeldSlugsWithUnlockDates(user.id, query.festivalId),
    metricsRepo.getMetrics(user.id, query.festivalId),
  ]);

  const { progress } = evaluate(metrics, new Set(unlockDates.keys()));

  const progressBySeriesId = new Map(
    progress.map((seriesProgress) => [seriesProgress.seriesId, seriesProgress]),
  );
  const cards = buildSeriesCards(unlockDates, progressBySeriesId);

  return c.json(
    {
      cards,
      recentUnlocks: buildRecentUnlocks(cards),
      stats: buildStats(cards),
    },
    200,
  );
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

  const leaderboard: AchievementLeaderboardEntry[] = (data || []).map((entry: any) => ({
    user_id: entry.user_id,
    username: entry.username,
    full_name: entry.full_name,
    avatar_url: entry.avatar_url,
    total_achievements: entry.total_achievements,
    total_points: entry.total_points,
  }));

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

  const achievements: AvailableAchievement[] = (data || []).map((achievement: any) => ({
    id: achievement.id,
    name: achievement.name,
    description: achievement.description,
    category: achievement.category,
    icon: achievement.icon,
    points: achievement.points,
    rarity: achievement.rarity,
    is_active: achievement.is_active,
  }));

  return c.json({ data: achievements }, 200);
});

// GET /achievements/pending - Unlocks not yet shown to the user
const getPendingUnlocksRoute = createRoute({
  method: "get",
  path: "/achievements/pending",
  tags: ["achievements"],
  summary: "List unlocks not yet shown in-app",
  description:
    "Returns achievement unlocks that have not been acknowledged with POST /achievements/seen. Newest first, capped at 10.",
  responses: {
    200: {
      description: "Pending unlocks retrieved successfully",
      content: {
        "application/json": {
          schema: GetPendingUnlocksResponseSchema,
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

app.openapi(getPendingUnlocksRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;

  const metricsRepo = new AchievementMetricsRepository(supabase);
  const data = await metricsRepo.listPendingUnlocks(user.id);

  return c.json({ data }, 200);
});

// POST /achievements/seen - Acknowledge unlocks shown in-app
const markUnlocksSeenRoute = createRoute({
  method: "post",
  path: "/achievements/seen",
  tags: ["achievements"],
  summary: "Acknowledge unlocks shown in-app",
  description:
    "Marks the given achievement events as shown to the user, which suppresses the redundant push notification for them.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: MarkUnlocksSeenSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Unlocks acknowledged",
      content: {
        "application/json": {
          schema: MarkUnlocksSeenResponseSchema,
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

app.openapi(markUnlocksSeenRoute, async (c) => {
  const user = c.var.user;
  const supabase = c.var.supabase;
  const { eventIds } = c.req.valid("json");

  const metricsRepo = new AchievementMetricsRepository(supabase);
  const acknowledged = await metricsRepo.markUnlocksSeen(user.id, eventIds);

  return c.json({ acknowledged }, 200);
});

export default app;
