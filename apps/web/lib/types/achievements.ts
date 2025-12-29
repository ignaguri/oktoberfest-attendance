import type { Database, Tables } from "@/lib/database.types";

export type Achievement = Tables<"achievements">;
export type UserAchievement = Tables<"user_achievements">;

export type AchievementCategory =
  Database["public"]["Enums"]["achievement_category_enum"];
export type AchievementRarity =
  Database["public"]["Enums"]["achievement_rarity_enum"];

export interface AchievementConditions {
  type: "threshold" | "streak" | "variety" | "special";
  target_value?: number;
  min_days?: number;
  date_specific?: string;
  tent_categories?: string[];
  comparison_operator?: "gte" | "eq" | "lte";
}

export interface AchievementProgress {
  current_value: number;
  target_value: number;
  percentage: number;
  last_updated: string;
}

export interface AchievementWithProgress extends Achievement {
  user_progress?: AchievementProgress;
  is_unlocked: boolean;
  unlocked_at?: string;
}

export interface AchievementStats {
  total_achievements: number;
  unlocked_achievements: number;
  total_points: number;
  breakdown_by_category: Record<
    AchievementCategory,
    {
      total: number;
      unlocked: number;
      points: number;
    }
  >;
  breakdown_by_rarity: Record<
    AchievementRarity,
    {
      total: number;
      unlocked: number;
      points: number;
    }
  >;
}

export interface AchievementNotification {
  achievement: Achievement;
  unlocked_at: string;
  new_total_points: number;
}
