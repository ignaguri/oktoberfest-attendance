import type { Database } from "@prostcounter/db";
import type { AchievementMetrics, UnlockedAchievement } from "@prostcounter/shared/achievements";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";

export class AchievementMetricsRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getMetrics(userId: string, festivalId: string): Promise<AchievementMetrics> {
    const { data, error } = await this.supabase.rpc("get_achievement_metrics", {
      p_user_id: userId,
      p_festival_id: festivalId,
    });

    if (error) {
      throw new DatabaseError(`Failed to fetch achievement metrics: ${error.message}`);
    }

    return data as unknown as AchievementMetrics;
  }

  /**
   * Slugs the user already holds, covering both scopes: rows for this festival
   * plus lifetime rows, which carry a NULL festival_id.
   */
  async getHeldSlugs(userId: string, festivalId: string): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from("user_achievements")
      .select("achievements(slug)")
      .eq("user_id", userId)
      .or(`festival_id.eq.${festivalId},festival_id.is.null`);

    if (error) {
      throw new DatabaseError(`Failed to fetch held achievements: ${error.message}`);
    }

    const slugs = new Set<string>();
    for (const row of data ?? []) {
      const slug = (row as { achievements: { slug: string | null } | null }).achievements?.slug;
      if (slug) {
        slugs.add(slug);
      }
    }
    return slugs;
  }

  /**
   * Slugs the user already holds, mapped to when each was unlocked. Same
   * dual-scope query as getHeldSlugs (festival rows plus lifetime rows).
   */
  async getHeldSlugsWithUnlockDates(
    userId: string,
    festivalId: string,
  ): Promise<Map<string, string>> {
    const { data, error } = await this.supabase
      .from("user_achievements")
      .select("unlocked_at, achievements(slug)")
      .eq("user_id", userId)
      .or(`festival_id.eq.${festivalId},festival_id.is.null`);

    if (error) {
      throw new DatabaseError(`Failed to fetch held achievement unlock dates: ${error.message}`);
    }

    const dates = new Map<string, string>();
    for (const row of data ?? []) {
      const slug = (row as { achievements: { slug: string | null } | null }).achievements?.slug;
      if (slug && row.unlocked_at) {
        dates.set(slug, row.unlocked_at);
      }
    }
    return dates;
  }

  /**
   * Inserts unlock rows. Lifetime unlocks are stored with a NULL festival_id.
   * Conflicts are ignored so concurrent evaluations cannot double-insert.
   */
  async insertUnlocks(
    userId: string,
    festivalId: string,
    unlocks: UnlockedAchievement[],
  ): Promise<UnlockedAchievement[]> {
    if (unlocks.length === 0) {
      return [];
    }

    const slugs = unlocks.map((unlock) => unlock.slug);
    const { data: rows, error: lookupError } = await this.supabase
      .from("achievements")
      .select("id, slug")
      .in("slug", slugs);

    if (lookupError) {
      throw new DatabaseError(`Failed to resolve achievement slugs: ${lookupError.message}`);
    }

    const slugToId = new Map<string, string>();
    for (const row of rows ?? []) {
      if (row.slug) {
        slugToId.set(row.slug, row.id);
      }
    }

    const payload = unlocks
      .filter((unlock) => slugToId.has(unlock.slug))
      .map((unlock) => ({
        user_id: userId,
        achievement_id: slugToId.get(unlock.slug) as string,
        festival_id: unlock.scope === "lifetime" ? null : festivalId,
      }));

    if (payload.length === 0) {
      return [];
    }

    const { error: insertError } = await this.supabase
      .from("user_achievements")
      .upsert(payload, {
        onConflict: "user_id,achievement_id,festival_id",
        ignoreDuplicates: true,
      });

    if (insertError) {
      throw new DatabaseError(`Failed to insert unlocks: ${insertError.message}`);
    }

    return unlocks.filter((unlock) => slugToId.has(unlock.slug));
  }
}
