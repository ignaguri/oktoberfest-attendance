import type { Database } from "@prostcounter/db";
import type {
  AchievementMetrics,
  BooleanMetricKey,
  NumericMetricKey,
  UnlockedAchievement,
} from "@prostcounter/shared/achievements";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { logger } from "../../lib/logger";
import { DatabaseError } from "../../middleware/error";

// Validates the shape of get_achievement_metrics' jsonb response, the one
// point it crosses from SQL into TS. Split into two Record<Key, ZodType>
// literals rather than one z.object({...}) so both directions are a compile
// error: a metric added to AchievementMetrics without a matching key here
// (missing key), or a stray/renamed key here that AchievementMetrics doesn't
// have (excess-property check on the Record-typed literal). Same
// exhaustiveness guarantee METRIC_KEYS_RECORD gives the TS side, now
// enforced at runtime against what the SQL function actually returns.
const numericMetricsShape: Record<NumericMetricKey, z.ZodNumber> = {
  drinks_total: z.number(),
  drinks_day_max: z.number(),
  drink_types_distinct: z.number(),
  volume_ml_total: z.number(),
  tip_cents_total: z.number(),
  spend_cents_total: z.number(),
  days_attended: z.number(),
  attendance_streak_max: z.number(),
  tents_distinct: z.number(),
  groups_joined: z.number(),
  photos_uploaded: z.number(),
  reactions_given: z.number(),
  crowd_reports: z.number(),
  festivals_attended: z.number(),
  festival_types_distinct: z.number(),
  friends_accepted: z.number(),
  group_wins: z.number(),
  podium_finishes: z.number(),
  active_days_total: z.number(),
  active_day_streak_max: z.number(),
};

const booleanMetricsShape: Record<BooleanMetricKey, z.ZodBoolean> = {
  attended_opening_day: z.boolean(),
  attended_closing_day: z.boolean(),
  attended_every_day: z.boolean(),
  attended_every_weekend_day: z.boolean(),
  visited_all_large_tents: z.boolean(),
  created_group: z.boolean(),
  logged_first_drink: z.boolean(),
  uploaded_first_photo: z.boolean(),
  profile_complete: z.boolean(),
  wrapped_viewed: z.boolean(),
};

const AchievementMetricsSchema = z.object({
  ...numericMetricsShape,
  ...booleanMetricsShape,
}) satisfies z.ZodType<AchievementMetrics>;

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

    const result = AchievementMetricsSchema.safeParse(data);
    if (!result.success) {
      throw new DatabaseError(
        `get_achievement_metrics returned an unexpected shape: ${result.error.message}`,
      );
    }

    return result.data;
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

    // A slug the evaluator produced but the registry doesn't have means the
    // sync script (pnpm --filter=@prostcounter/api sync:achievements) hasn't
    // run since a definition was added, or has drifted. Log loudly rather
    // than silently dropping it: a silent drop means this unlock is never
    // persisted and gets silently recomputed on every future evaluation.
    const unresolvedSlugs = unlocks
      .map((unlock) => unlock.slug)
      .filter((slug) => !slugToId.has(slug));
    if (unresolvedSlugs.length > 0) {
      logger.error(
        { userId, festivalId, unresolvedSlugs },
        "Achievement registry is missing slugs the evaluator unlocked; run the registry sync",
      );
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
