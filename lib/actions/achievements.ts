"use server";

import { createClient } from "@/utils/supabase/server";

import type { FunctionReturns } from "@/lib/database-helpers.types";
import type {
  AchievementWithProgress,
  AchievementStats,
} from "@/lib/types/achievements";

export async function getUserAchievements(
  festivalId: string,
): Promise<AchievementWithProgress[]> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase.rpc("get_user_achievements", {
    p_user_id: user.id,
    p_festival_id: festivalId,
  });

  if (error) {
    console.error("Error fetching user achievements:", error);
    throw new Error("Failed to fetch achievements");
  }

  return (
    data?.map((achievement: FunctionReturns<"get_user_achievements", 0>) => ({
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
    })) || []
  );
}

export async function evaluateAchievements(festivalId: string): Promise<void> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User not authenticated");
  }

  const { error } = await supabase.rpc("evaluate_user_achievements", {
    p_user_id: user.id,
    p_festival_id: festivalId,
  });

  if (error) {
    console.error("Error evaluating achievements:", error);
    throw new Error("Failed to evaluate achievements");
  }
}

export async function getAchievementLeaderboard(festivalId: string): Promise<
  {
    avatar_url: string;
    full_name: string;
    total_achievements: number;
    total_points: number;
    user_id: string;
    username: string;
  }[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_achievement_leaderboard", {
    p_festival_id: festivalId,
  });

  if (error) {
    console.error("Error fetching achievement leaderboard:", error);
    throw new Error("Failed to fetch achievement leaderboard");
  }

  return data || [];
}

export async function getUserAchievementStats(
  festivalId: string,
): Promise<AchievementStats> {
  const achievements = await getUserAchievements(festivalId);

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

  return stats;
}
