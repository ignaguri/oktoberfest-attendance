import type { Database } from "@prostcounter/db";
import type {
  ListAchievementsQuery,
  UserAchievement,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";
import type { IAchievementRepository } from "../interfaces";

export class SupabaseAchievementRepository implements IAchievementRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async listUserAchievements(
    userId: string,
    query: ListAchievementsQuery,
  ): Promise<UserAchievement[]> {
    let supabaseQuery = this.supabase
      .from("achievement_events")
      .select(
        `
        *,
        achievements (
          id,
          name,
          description,
          category,
          icon,
          points,
          rarity,
          condition,
          created_at,
          updated_at
        )
      `,
      )
      .eq("user_id", userId)
      .eq("festival_id", query.festivalId);

    if (query.category) {
      // Need to filter via achievements table
      supabaseQuery = supabaseQuery.eq("achievements.category", query.category);
    }

    supabaseQuery = supabaseQuery.order("created_at", { ascending: false });

    const { data, error } = await supabaseQuery;

    if (error) {
      throw new DatabaseError(`Failed to list achievements: ${error.message}`);
    }

    return data.map((item) => this.mapToUserAchievement(item));
  }

  async getTotalPoints(userId: string, festivalId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from("achievement_events")
      .select("achievements(points)")
      .eq("user_id", userId)
      .eq("festival_id", festivalId);

    if (error) {
      throw new DatabaseError(`Failed to calculate points: ${error.message}`);
    }

    const totalPoints = data.reduce((sum, item) => {
      const points = (item.achievements as any)?.points || 0;
      return sum + points;
    }, 0);

    return totalPoints;
  }

  private mapToUserAchievement(data: any): UserAchievement {
    const achievement = data.achievements as any;
    return {
      id: data.id,
      userId: data.user_id,
      achievementId: data.achievement_id,
      festivalId: data.festival_id,
      rarity: data.rarity,
      unlockedAt: data.created_at,
      userNotifiedAt: data.user_notified_at,
      groupNotifiedAt: data.group_notified_at,
      achievement: {
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        category: achievement.category,
        icon: achievement.icon,
        points: achievement.points,
        rarity: achievement.rarity,
        condition: achievement.condition,
        createdAt: achievement.created_at,
        updatedAt: achievement.updated_at,
      },
    };
  }
}
