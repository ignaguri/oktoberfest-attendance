import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type {
  AchievementLeaderboardEntry,
  AchievementStats,
  AchievementWithProgress,
  AvailableAchievement,
} from "@prostcounter/shared";
import {
  EvaluateAchievementsResponseSchema,
  EvaluateAchievementsSchema,
  GetAchievementLeaderboardResponseSchema,
  GetAchievementsWithProgressResponseSchema,
  ListAchievementsQuerySchema,
  ListAchievementsResponseSchema,
  ListAvailableAchievementsResponseSchema,
} from "@prostcounter/shared";
import { SERIES } from "@prostcounter/shared/achievements";

import type { AuthContext } from "../middleware/auth";
import { AchievementMetricsRepository } from "../repositories/supabase/achievement-metrics.repository";
import { SupabaseAchievementRepository } from "../repositories/supabase";
import { AchievementService } from "../services/achievement.service";

/**
 * Temporary bridge: the current UI still renders by rarity. Plan 2 drops the
 * rarity column and Plan 3 replaces the UI with tier frames. Until then, map
 * tier onto the rarity vocabulary the existing components expect.
 *
 * Takes `number | null` rather than a 1..4 union because `row.tier` comes from
 * the database as a nullable number and cannot be narrowed at the type level.
 */
function tierToRarity(tier: number | null): "common" | "rare" | "epic" | "legendary" {
  switch (tier) {
    case 2:
      return "rare";
    case 3:
      return "epic";
    case 4:
      return "legendary";
    default:
      return "common";
  }
}

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
  const achievementService = new AchievementService(metricsRepo);

  const [{ progress }, heldSlugs, registry] = await Promise.all([
    achievementService.getProgress(user.id, query.festivalId),
    metricsRepo.getHeldSlugs(user.id, query.festivalId),
    supabase
      .from("achievements")
      .select("id, slug, series_id, tier, scope, category, points, icon, name, description")
      .not("slug", "is", null)
      .order("category")
      .order("points"),
  ]);

  if (registry.error) {
    throw new Error(`Failed to fetch achievement registry: ${registry.error.message}`);
  }

  const progressBySeries = new Map(progress.map((entry) => [entry.seriesId, entry]));
  const seriesById = new Map(SERIES.map((series) => [series.id, series]));

  // `progress` from evaluate() has ONE entry per series: the series' overall
  // standing toward whichever locked tier comes next. But `registry.data`
  // has one ROW PER TIER (80 of the 90 rows: 20 series x 4 tiers), and
  // AchievementWithProgressSchema gives every row its own user_progress. If
  // every tier row of a series just reused the single series-level entry,
  // every locked tier beyond the immediately-next one would display the
  // WRONG target and percentage (borrowed from whatever tier happens to be
  // "next", not its own threshold) — e.g. a tier-3 row with target 25 would
  // show target 10 (tier 2's number) while the user is still working on
  // tier 2. So each row computes its own target from that tier's definition,
  // and its own percentage using the same floor/span formula evaluate() uses
  // for the "next" tier, just anchored to THIS row's tier instead.
  const achievements: AchievementWithProgress[] = (registry.data ?? []).map((row) => {
    const isUnlocked = row.slug ? heldSlugs.has(row.slug) : false;
    const seriesProgress = row.series_id ? progressBySeries.get(row.series_id) : undefined;

    let currentValue = isUnlocked ? 1 : 0;
    let targetValue = 1;
    let percentage = isUnlocked ? 100 : 0;

    if (row.series_id && row.tier && seriesProgress) {
      const series = seriesById.get(row.series_id);
      const ownTierDef = series?.tiers.find((t) => t.tier === row.tier);
      const priorTierDef = series?.tiers.find((t) => t.tier === row.tier - 1);
      const floor = priorTierDef?.target ?? 0;
      const target = ownTierDef?.target ?? seriesProgress.nextTarget ?? 1;

      currentValue = seriesProgress.currentValue;
      targetValue = target;

      if (isUnlocked) {
        percentage = 100;
      } else {
        // Same formula as evaluate()'s progress calc, anchored to this row's
        // own tier rather than only ever the next one.
        const span = target - floor;
        const gained = currentValue - floor;
        percentage =
          span <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((gained / span) * 100)));
      }
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      icon: row.icon,
      points: row.points,
      rarity: tierToRarity(row.tier),
      conditions: {},
      is_active: true,
      created_at: "",
      updated_at: "",
      is_unlocked: isUnlocked,
      unlocked_at: null,
      user_progress: {
        current_value: currentValue,
        target_value: targetValue,
        percentage,
        last_updated: new Date().toISOString(),
      },
    } as AchievementWithProgress;
  });

  const stats: AchievementStats = {
    total_achievements: achievements.length,
    unlocked_achievements: achievements.filter((a) => a.is_unlocked).length,
    total_points: achievements.filter((a) => a.is_unlocked).reduce((sum, a) => sum + a.points, 0),
    breakdown_by_category: {
      consumption: { total: 0, unlocked: 0, points: 0 },
      attendance: { total: 0, unlocked: 0, points: 0 },
      explorer: { total: 0, unlocked: 0, points: 0 },
      social: { total: 0, unlocked: 0, points: 0 },
      competitive: { total: 0, unlocked: 0, points: 0 },
      special: { total: 0, unlocked: 0, points: 0 },
      drinking: { total: 0, unlocked: 0, points: 0 },
      dedication: { total: 0, unlocked: 0, points: 0 },
    } as AchievementStats["breakdown_by_category"],
    breakdown_by_rarity: {
      common: { total: 0, unlocked: 0, points: 0 },
      rare: { total: 0, unlocked: 0, points: 0 },
      epic: { total: 0, unlocked: 0, points: 0 },
      legendary: { total: 0, unlocked: 0, points: 0 },
    },
  };

  achievements.forEach((achievement) => {
    const categoryBucket = stats.breakdown_by_category[achievement.category];
    const rarityBucket = stats.breakdown_by_rarity[achievement.rarity];

    if (categoryBucket) {
      categoryBucket.total++;
    }
    if (rarityBucket) {
      rarityBucket.total++;
    }

    if (achievement.is_unlocked) {
      if (categoryBucket) {
        categoryBucket.unlocked++;
        categoryBucket.points += achievement.points;
      }
      if (rarityBucket) {
        rarityBucket.unlocked++;
        rarityBucket.points += achievement.points;
      }
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

export default app;
