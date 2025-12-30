import type { IWrappedRepository } from "../interfaces/wrapped.repository";
import type { Database } from "@prostcounter/db";
import type { WrappedData } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError, NotFoundError } from "../../middleware/error";

export class SupabaseWrappedRepository implements IWrappedRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getCached(
    userId: string,
    festivalId: string,
  ): Promise<WrappedData | null> {
    const { data, error } = await this.supabase.rpc("get_wrapped_data_cached", {
      p_user_id: userId,
      p_festival_id: festivalId,
    });

    if (error) {
      throw new DatabaseError(
        `Failed to fetch cached wrapped data: ${error.message}`,
      );
    }

    if (!data) return null;

    return this.mapToWrappedData(data as any, userId, festivalId);
  }

  async generate(
    userId: string,
    festivalId: string,
    force = false,
  ): Promise<WrappedData> {
    // If force regeneration, invalidate cache first
    if (force) {
      await this.invalidateCache(userId, festivalId);
    }

    // Call the database function to generate/fetch wrapped data
    const { data, error } = await this.supabase.rpc("get_wrapped_data", {
      p_user_id: userId,
      p_festival_id: festivalId,
    });

    if (error) {
      throw new DatabaseError(
        `Failed to generate wrapped data: ${error.message}`,
      );
    }

    if (!data) {
      throw new NotFoundError("No wrapped data available for this festival");
    }

    return this.mapToWrappedData(data as any, userId, festivalId);
  }

  async invalidateCache(userId: string, festivalId?: string): Promise<void> {
    const { error } = await this.supabase.rpc("invalidate_wrapped_cache", {
      p_user_id: userId,
      p_festival_id: festivalId,
    });

    if (error) {
      throw new DatabaseError(
        `Failed to invalidate wrapped cache: ${error.message}`,
      );
    }
  }

  async isCached(userId: string, festivalId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("wrapped_data_cache")
      .select("id")
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .gte(
        "updated_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      ) // Within last 24 hours
      .single();

    if (error && error.code !== "PGRST116") {
      // Ignore "no rows" error
      throw new DatabaseError(
        `Failed to check wrapped cache: ${error.message}`,
      );
    }

    return !!data;
  }

  /**
   * Map database JSON to WrappedData schema
   */
  private mapToWrappedData(
    data: any,
    userId: string,
    festivalId: string,
  ): WrappedData {
    return {
      userId,
      festivalId,
      totalDays: data.total_days || 0,
      totalBeers: data.total_beers || 0,
      totalSpent: data.total_spent || 0,
      avgBeersPerDay: data.avg_beers_per_day || 0,
      favoriteTent: data.favorite_tent
        ? {
            id: data.favorite_tent.id,
            name: data.favorite_tent.name,
            visitCount: data.favorite_tent.visit_count || 0,
          }
        : null,
      topDrinkType: data.top_drink_type || null,
      achievements: data.achievements || [],
      globalRank: data.global_rank || null,
      groupRanks: data.group_ranks || [],
      firstVisitDate: data.first_visit_date || null,
      lastVisitDate: data.last_visit_date || null,
      longestStreak: data.longest_streak || 0,
      generatedAt: data.generated_at || new Date().toISOString(),
    };
  }
}
