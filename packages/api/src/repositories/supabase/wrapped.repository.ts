import type { Database } from "@prostcounter/db";
import type {
  AvailableWrappedFestival,
  WrappedAccessResult,
  WrappedData,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  DatabaseError,
  ForbiddenError,
  NotFoundError,
} from "../../middleware/error";
import type { IWrappedRepository } from "../interfaces/wrapped.repository";

/**
 * Access control configuration for wrapped feature
 */
const ACCESS_CONFIG = {
  allowInDev: true,
  requireFestivalEnded: true,
  minAttendanceDays: 0,
  allowedUsers: [] as string[],
};

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

  async checkAccess(
    userId: string,
    festivalId: string,
  ): Promise<WrappedAccessResult> {
    // Check if user is in allowed list
    const isAllowedUser = ACCESS_CONFIG.allowedUsers.includes(userId);
    if (isAllowedUser) {
      return { allowed: true };
    }

    // Allow in development environment
    if (ACCESS_CONFIG.allowInDev && process.env.NODE_ENV === "development") {
      return { allowed: true };
    }

    // Get festival to check status
    const { data: festival, error: festivalError } = await this.supabase
      .from("festivals")
      .select("id, name, status, start_date, end_date")
      .eq("id", festivalId)
      .single();

    if (festivalError || !festival) {
      return {
        allowed: false,
        reason: "error",
        message: "Could not verify festival information",
      };
    }

    // Check if festival has ended
    if (ACCESS_CONFIG.requireFestivalEnded && festival.status !== "ended") {
      return {
        allowed: false,
        reason: "not_ended",
        message: `Wrapped will be available after ${festival.name} ends`,
      };
    }

    // Check if user has any attendance data
    const { count, error: attendanceError } = await this.supabase
      .from("attendances")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("festival_id", festivalId);

    if (attendanceError) {
      return {
        allowed: false,
        reason: "error",
        message: "Could not verify your festival attendance",
      };
    }

    // Check minimum days requirement
    if (
      ACCESS_CONFIG.minAttendanceDays > 0 &&
      (count === null || count < ACCESS_CONFIG.minAttendanceDays)
    ) {
      return {
        allowed: false,
        reason: "no_data",
        message: `You need at least ${ACCESS_CONFIG.minAttendanceDays} day(s) of attendance to view your wrapped`,
      };
    }

    return { allowed: true };
  }

  async getAvailableFestivals(
    userId: string,
  ): Promise<AvailableWrappedFestival[]> {
    // In development, show all festivals
    // In production, only show ended festivals
    let festivalQuery = this.supabase
      .from("festivals")
      .select("id, name, start_date, status")
      .order("start_date", { ascending: false });

    if (!ACCESS_CONFIG.allowInDev || process.env.NODE_ENV !== "development") {
      festivalQuery = festivalQuery.eq("status", "ended");
    }

    const { data: festivals, error: festivalsError } = await festivalQuery;

    if (festivalsError || !festivals) {
      throw new DatabaseError(
        `Failed to fetch festivals for wrapped: ${festivalsError?.message || "Unknown error"}`,
      );
    }

    // Check which festivals user has data for
    const { data: userAttendances, error: attendanceError } =
      await this.supabase
        .from("attendances")
        .select("festival_id")
        .eq("user_id", userId);

    if (attendanceError) {
      throw new DatabaseError(
        `Failed to fetch user attendances for wrapped: ${attendanceError.message}`,
      );
    }

    const festivalIdsWithData = new Set(
      (userAttendances || []).map((a) => a.festival_id),
    );

    return festivals.map((festival) => ({
      id: festival.id,
      name: festival.name,
      year: new Date(festival.start_date).getFullYear(),
      status: festival.status,
      hasData: festivalIdsWithData.has(festival.id),
    }));
  }

  async regenerateCache(
    adminUserId: string,
    festivalId?: string,
    userId?: string,
  ): Promise<number> {
    // Verify admin permissions
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new ForbiddenError("Insufficient permissions to regenerate cache");
    }

    // Call the database function to regenerate cache
    const { data: regeneratedCount, error } = await this.supabase.rpc(
      "regenerate_wrapped_data_cache",
      {
        p_user_id: userId,
        p_festival_id: festivalId,
        p_admin_user_id: adminUserId,
      },
    );

    if (error) {
      throw new DatabaseError(
        `Failed to regenerate wrapped cache: ${error.message}`,
      );
    }

    return regeneratedCount || 0;
  }

  async isAdmin(userId: string): Promise<boolean> {
    const { data: profile, error } = await this.supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", userId)
      .single();

    if (error) {
      return false;
    }

    return profile?.is_super_admin === true;
  }
}
