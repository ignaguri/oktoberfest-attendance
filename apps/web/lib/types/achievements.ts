import type { Database, Tables } from "@prostcounter/db";

export type Achievement = Tables<"achievements">;
export type UserAchievement = Tables<"user_achievements">;

export type AchievementCategory = Database["public"]["Enums"]["achievement_category_enum"];
export type AchievementRarity = Database["public"]["Enums"]["achievement_rarity_enum"];

export interface AchievementConditions {
  type: "threshold" | "streak" | "variety" | "special";
  target_value?: number;
  min_days?: number;
  date_specific?: string;
  tent_categories?: string[];
  comparison_operator?: "gte" | "eq" | "lte";
}

export interface AchievementNotification {
  achievement: Achievement;
  unlocked_at: string;
  new_total_points: number;
}
