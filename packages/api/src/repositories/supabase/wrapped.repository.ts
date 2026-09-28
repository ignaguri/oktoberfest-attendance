import type { Database } from "@prostcounter/db";
import type { WrappedData, WrappedFestival } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError, ForbiddenError } from "../../middleware/error";
import type { IWrappedRepository, WrappedStatus } from "../interfaces/wrapped.repository";
import { mapToWrappedData } from "./wrapped-mapper";

export class SupabaseWrappedRepository implements IWrappedRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getStatus(festivalId: string): Promise<WrappedStatus | null> {
    const { data, error } = await this.supabase.rpc("get_wrapped_status", {
      p_festival_id: festivalId,
    });

    if (error) {
      throw new DatabaseError(`Failed to fetch wrapped status: ${error.message}`);
    }

    const row = data?.[0];
    if (!row) {
      return null;
    }

    return {
      unlocksAt: new Date(row.unlocks_at).toISOString(),
      isUnlocked: row.is_unlocked,
      hasAttendance: row.has_attendance,
    };
  }

  async getWrapped(userId: string, festivalId: string): Promise<WrappedData> {
    const { data, error } = await this.supabase.rpc("get_wrapped_data_cached", {
      p_user_id: userId,
      p_festival_id: festivalId,
    });

    if (error) {
      throw new DatabaseError(`Failed to fetch wrapped data: ${error.message}`);
    }

    return mapToWrappedData(data);
  }

  async listFestivals(): Promise<WrappedFestival[]> {
    const { data, error } = await this.supabase.rpc("get_wrapped_festivals");

    if (error) {
      throw new DatabaseError(`Failed to fetch wrapped festivals: ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      festivalId: row.festival_id,
      name: row.name,
      startDate: row.start_date,
      endDate: row.end_date,
      unlocksAt: new Date(row.unlocks_at).toISOString(),
      viewed: row.viewed,
    }));
  }

  async markViewed(userId: string, festivalId: string): Promise<void> {
    // The cache stamp is what get_achievement_metrics reads for wrapped_viewed.
    // Cache invalidation deletes that row, so the durable record for analytics
    // is wrapped_views.
    const { error: cacheError } = await this.supabase
      .from("wrapped_data_cache")
      .update({ first_viewed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("festival_id", festivalId)
      .is("first_viewed_at", null);

    if (cacheError) {
      throw new DatabaseError(`Failed to mark wrapped as viewed: ${cacheError.message}`);
    }

    const { error: viewError } = await this.supabase
      .from("wrapped_views")
      .upsert(
        { user_id: userId, festival_id: festivalId },
        { onConflict: "user_id,festival_id", ignoreDuplicates: true },
      );

    if (viewError) {
      throw new DatabaseError(`Failed to record wrapped view: ${viewError.message}`);
    }
  }

  async invalidateCache(userId: string, festivalId?: string): Promise<void> {
    const { error } = await this.supabase.rpc("invalidate_wrapped_cache", {
      p_user_id: userId,
      p_festival_id: festivalId,
    });

    if (error) {
      throw new DatabaseError(`Failed to invalidate wrapped cache: ${error.message}`);
    }
  }

  async regenerateCache(adminUserId: string, festivalId?: string, userId?: string): Promise<number> {
    const isAdmin = await this.isAdmin(adminUserId);
    if (!isAdmin) {
      throw new ForbiddenError("Insufficient permissions to regenerate cache");
    }

    const { data: regeneratedCount, error } = await this.supabase.rpc(
      "regenerate_wrapped_data_cache",
      {
        p_user_id: userId,
        p_festival_id: festivalId,
      },
    );

    if (error) {
      throw new DatabaseError(`Failed to regenerate wrapped cache: ${error.message}`);
    }

    return regeneratedCount || 0;
  }

  async isAdmin(userId: string): Promise<boolean> {
    const { data: profile, error } = await this.supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      return false;
    }

    return profile.is_super_admin === true;
  }
}
