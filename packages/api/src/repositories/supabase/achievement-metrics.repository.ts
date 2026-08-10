import type { Database } from "@prostcounter/db";
import type { PendingUnlock } from "@prostcounter/shared";
import type {
  AchievementMetrics,
  BooleanMetricKey,
  NumericMetricKey,
  PersistedUnlock,
  UnlockedAchievement,
} from "@prostcounter/shared/achievements";
import { describeUnlock } from "@prostcounter/shared/achievements";
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

  async getMetrics(userId: string, festivalId: string | null): Promise<AchievementMetrics> {
    const { data, error } = await this.supabase.rpc("get_achievement_metrics", {
      p_user_id: userId,
      // The generated Args type says `string`, but the SQL parameter has no
      // NOT NULL constraint and the function computes lifetime metrics
      // independently of festival scope when this is NULL (verified against
      // a live database on 2026-08-06). The generated type just doesn't
      // capture per-argument nullability.
      p_festival_id: festivalId as unknown as string,
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
  async getHeldSlugs(userId: string, festivalId: string | null): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from("user_achievements")
      .select("achievements(slug)")
      .eq("user_id", userId)
      .or(festivalId === null ? "festival_id.is.null" : `festival_id.eq.${festivalId},festival_id.is.null`);

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
    festivalId: string | null,
  ): Promise<Map<string, string>> {
    const { data, error } = await this.supabase
      .from("user_achievements")
      .select("unlocked_at, achievements(slug)")
      .eq("user_id", userId)
      .or(festivalId === null ? "festival_id.is.null" : `festival_id.eq.${festivalId},festival_id.is.null`);

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
   * Inserts unlock rows and returns only the ones this call genuinely created,
   * each carrying its outbox event id. Lifetime unlocks are stored with a NULL
   * festival_id. Conflicts are ignored so concurrent evaluations cannot
   * double-insert — and, because only real inserts come back, cannot
   * double-report either.
   */
  async insertUnlocks(
    userId: string,
    festivalId: string | null,
    unlocks: UnlockedAchievement[],
  ): Promise<PersistedUnlock[]> {
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

    // A festival-scoped unlock with a null festivalId would insert a row that
    // can never be looked up again (getHeldSlugs matches festival-scoped rows
    // by exact festival_id). It should never happen: a NULL festivalId call
    // only occurs for the lifetime-metrics pass, where every festival-scoped
    // metric reads 0/false, so evaluate() cannot produce a festival-scoped
    // unlock. Guarded explicitly rather than trusted implicitly.
    const orphanedFestivalUnlock = unlocks.find(
      (unlock) => unlock.scope !== "lifetime" && festivalId === null,
    );
    if (orphanedFestivalUnlock) {
      throw new DatabaseError(
        `insertUnlocks received a festival-scoped unlock (${orphanedFestivalUnlock.slug}) with no festivalId`,
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

    // .select() with ignoreDuplicates returns only the rows this call actually
    // inserted. Without it the method returned everything it attempted, so two
    // concurrent evaluations both reported the same unlock and the user saw a
    // duplicate toast.
    const { data: insertedRows, error: insertError } = await this.supabase
      .from("user_achievements")
      .upsert(payload, {
        onConflict: "user_id,achievement_id,festival_id",
        ignoreDuplicates: true,
      })
      .select("achievement_id");

    if (insertError) {
      throw new DatabaseError(`Failed to insert unlocks: ${insertError.message}`);
    }

    const insertedAchievementIds = new Set(
      (insertedRows ?? []).map((row) => row.achievement_id),
    );

    if (insertedAchievementIds.size === 0) {
      return [];
    }

    // The outbox row is written by trg_user_achievements_insert_event, an AFTER
    // INSERT trigger in the same transaction, so it exists by the time the
    // upsert returns. It is looked up rather than returned because a trigger's
    // output cannot reach the inserting statement's RETURNING clause.
    //
    // Looked up per festival_id, not just per achievement_id: the same
    // achievement can be unlocked separately in two festivals (the unique
    // constraint is on user_id + achievement_id + festival_id), so a stale
    // unacked event from a different festival could otherwise be matched to
    // this call's new unlock and reported with the wrong event id.
    const lifetimeInsertedIds = new Set<string>();
    const festivalInsertedIds = new Set<string>();
    for (const unlock of unlocks) {
      const achievementId = slugToId.get(unlock.slug);
      if (!achievementId || !insertedAchievementIds.has(achievementId)) {
        continue;
      }
      if (unlock.scope === "lifetime") {
        lifetimeInsertedIds.add(achievementId);
      } else {
        festivalInsertedIds.add(achievementId);
      }
    }

    const eventIdByAchievementId = new Map<string, string>();

    if (lifetimeInsertedIds.size > 0) {
      const { data: lifetimeEventRows, error: lifetimeEventError } = await this.supabase
        .from("achievement_events")
        .select("id, achievement_id")
        .eq("user_id", userId)
        .in("achievement_id", [...lifetimeInsertedIds])
        .is("festival_id", null)
        .is("user_notified_at", null);

      if (lifetimeEventError) {
        throw new DatabaseError(`Failed to resolve unlock events: ${lifetimeEventError.message}`);
      }
      for (const row of lifetimeEventRows ?? []) {
        eventIdByAchievementId.set(row.achievement_id, row.id);
      }
    }

    // festivalId === null means only the lifetime pass ran, so no
    // festival-scoped unlock can exist (see the orphanedFestivalUnlock guard
    // above) and this query would be meaningless.
    if (festivalInsertedIds.size > 0 && festivalId !== null) {
      const { data: festivalEventRows, error: festivalEventError } = await this.supabase
        .from("achievement_events")
        .select("id, achievement_id")
        .eq("user_id", userId)
        .in("achievement_id", [...festivalInsertedIds])
        .eq("festival_id", festivalId)
        .is("user_notified_at", null);

      if (festivalEventError) {
        throw new DatabaseError(`Failed to resolve unlock events: ${festivalEventError.message}`);
      }
      for (const row of festivalEventRows ?? []) {
        eventIdByAchievementId.set(row.achievement_id, row.id);
      }
    }

    return unlocks.flatMap((unlock) => {
      const achievementId = slugToId.get(unlock.slug);
      if (!achievementId || !insertedAchievementIds.has(achievementId)) {
        return [];
      }

      const eventId = eventIdByAchievementId.get(achievementId);
      if (!eventId) {
        // The unlock row is committed but its outbox event is missing, which
        // means the trigger did not fire. The user will never be told about
        // this unlock through any channel, so it must not be silent here.
        logger.error(
          { userId, festivalId, slug: unlock.slug },
          "Unlock persisted but no achievement_events row was found",
        );
        return [];
      }

      return [{ ...unlock, eventId }];
    });
  }

  /**
   * Unacked unlocks for this user, newest first.
   *
   * The database supplies the event id, the slug and the timestamp; everything
   * the toast renders comes from the TS definitions via describeUnlock, which
   * is the source of truth (master-doc decision D3). A slug no definition owns
   * is dropped with a log rather than rendered half-populated.
   */
  async listPendingUnlocks(userId: string, limit = 10): Promise<PendingUnlock[]> {
    const { data, error } = await this.supabase
      .from("achievement_events")
      .select("id, created_at, achievements(slug)")
      .eq("user_id", userId)
      .is("user_notified_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new DatabaseError(`Failed to fetch pending unlocks: ${error.message}`);
    }

    const pending: PendingUnlock[] = [];

    for (const row of data ?? []) {
      const slug = (row as { achievements: { slug: string | null } | null }).achievements?.slug;
      if (!slug) {
        continue;
      }

      const descriptor = describeUnlock(slug);
      if (!descriptor) {
        logger.error(
          { userId, slug, eventId: row.id },
          "Pending unlock references a slug no definition owns; run the registry sync",
        );
        continue;
      }

      pending.push({ ...descriptor, eventId: row.id, unlockedAt: row.created_at });
    }

    return pending;
  }

  /**
   * Stamps events as shown in-app. Scoped to the caller's own rows, and only
   * those not already stamped, so the returned count is the number of events
   * this call actually acked.
   */
  async markUnlocksSeen(userId: string, eventIds: string[]): Promise<number> {
    const { data, error } = await this.supabase
      .from("achievement_events")
      .update({ user_notified_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", eventIds)
      .is("user_notified_at", null)
      .select("id");

    if (error) {
      throw new DatabaseError(`Failed to mark unlocks seen: ${error.message}`);
    }

    return (data ?? []).length;
  }
}
