import type { Database } from "@prostcounter/db";
import type { WrappedData, WrappedFestival } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError, ForbiddenError } from "../../middleware/error";
import type { IWrappedRepository, WrappedStatus } from "../interfaces/wrapped.repository";
import { mapToWrappedData } from "./wrapped-mapper";

const REGENERATE_CONCURRENCY = 4;
const REGENERATE_PAGE_SIZE = 1000;

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

  async listOpenedPersonas(userId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from("persona_card_opens")
      .select("persona_id")
      .eq("user_id", userId);

    if (error) {
      throw new DatabaseError(`Failed to fetch opened persona cards: ${error.message}`);
    }

    return (data ?? []).map((row) => row.persona_id);
  }

  async markPersonaOpened(userId: string, personaId: string): Promise<void> {
    const { error } = await this.supabase
      .from("persona_card_opens")
      .upsert(
        { user_id: userId, persona_id: personaId },
        { onConflict: "user_id,persona_id", ignoreDuplicates: true },
      );

    if (error) {
      throw new DatabaseError(`Failed to record opened persona card: ${error.message}`);
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

    if (festivalId && userId) {
      return this.regenerateOne(userId, festivalId);
    }

    // One RPC per (user, festival): the function computes every target in one
    // statement, and the admin's JWT carries authenticated's 8s statement_timeout,
    // so a whole festival in one call would time out at production size.
    const targets = await this.listRegenerateTargets(festivalId, userId);
    let regeneratedCount = 0;

    for (let start = 0; start < targets.length; start += REGENERATE_CONCURRENCY) {
      const batch = targets.slice(start, start + REGENERATE_CONCURRENCY);
      const counts = await Promise.all(
        batch.map((target) => this.regenerateOne(target.userId, target.festivalId)),
      );
      regeneratedCount += counts.reduce((sum, count) => sum + count, 0);
    }

    return regeneratedCount;
  }

  private async regenerateOne(userId: string, festivalId: string): Promise<number> {
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

  /** Distinct (user, festival) pairs with an attendance. The RPC skips locked festivals. */
  private async listRegenerateTargets(
    festivalId?: string,
    userId?: string,
  ): Promise<{ userId: string; festivalId: string }[]> {
    const targets = new Map<string, { userId: string; festivalId: string }>();

    // Page until an empty page, advancing by the rows actually returned:
    // PostgREST's max-rows cap can be smaller than the requested page.
    let from = 0;
    for (;;) {
      let query = this.supabase.from("attendances").select("user_id, festival_id");
      if (festivalId) {
        query = query.eq("festival_id", festivalId);
      }
      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query
        .order("id")
        .range(from, from + REGENERATE_PAGE_SIZE - 1);

      if (error) {
        throw new DatabaseError(`Failed to list wrapped regenerate targets: ${error.message}`);
      }
      if (!data || data.length === 0) {
        break;
      }

      for (const row of data) {
        if (!row.user_id || !row.festival_id) {
          continue;
        }
        targets.set(`${row.user_id}:${row.festival_id}`, {
          userId: row.user_id,
          festivalId: row.festival_id,
        });
      }
      from += data.length;
    }

    return [...targets.values()];
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
