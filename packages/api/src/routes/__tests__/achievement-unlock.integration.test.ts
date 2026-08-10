// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test -- --run achievement-unlock.integration
import { describe, expect, it } from "vitest";

import { ACHIEVEMENT_METRIC_KEYS } from "@prostcounter/shared/achievements";

import { createTestSupabaseAdmin } from "../../__tests__/helpers/test-supabase";
import { AchievementMetricsRepository } from "../../repositories/supabase/achievement-metrics.repository";
import { AchievementService } from "../../services/achievement.service";

async function getTarget(supabaseAdmin: ReturnType<typeof createTestSupabaseAdmin>) {
  const { data: rows } = await supabaseAdmin
    .from("attendances")
    .select("user_id, festival_id")
    .limit(1);

  const target = rows?.[0];
  if (!target) {
    throw new Error("No attendance rows in local database; seed it first");
  }
  return target as { user_id: string; festival_id: string };
}

describe("achievement unlocking against a real database", () => {
  it("unlocks the first-drink achievement for a user with consumptions", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    const target = await getTarget(supabaseAdmin);

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    const service = new AchievementService(repo);

    // Compares the real SQL function's key set against AchievementMetrics,
    // not just a count: a renamed or dropped SQL key would pass a bare
    // toHaveLength(30) (still 30 keys, just the wrong ones) but fails this.
    const metrics = await repo.getMetrics(target.user_id, target.festival_id);
    expect(Object.keys(metrics).sort()).toEqual([...ACHIEVEMENT_METRIC_KEYS].sort());

    const unlocked = await service.evaluateAndUnlock(target.user_id, target.festival_id);

    // Second call must be a no-op: everything is already held.
    const second = await service.evaluateAndUnlock(target.user_id, target.festival_id);
    expect(second).toEqual([]);
    expect(Array.isArray(unlocked)).toBe(true);
    for (const unlock of unlocked) {
      expect(unlock).toEqual(expect.objectContaining({ eventId: expect.any(String) }));
    }
  });

  it("returns unlocks the first time and an empty array the second time", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();
    // Reuse an existing seeded user, but evaluate against a brand-new festival
    // this user has never attended. Held slugs are scoped per (user, festival),
    // so this guarantees a clean slate regardless of what earlier test runs
    // (in this file or previous suite runs against this persistent local DB)
    // already unlocked for that user elsewhere — unlike getTarget()'s arbitrary
    // pre-seeded row, which may already hold everything by the time this runs.
    const existing = await getTarget(supabaseAdmin);

    const { data: festival, error: festivalError } = await supabaseAdmin
      .from("festivals")
      .insert({
        name: `Unlock Test Festival ${Date.now()}`,
        short_name: `unlock-test-${Date.now()}`,
        festival_type: "oktoberfest",
        start_date: "2024-09-21",
        end_date: "2024-10-06",
        beer_cost: 16.2,
        location: "Test Location",
        timezone: "Europe/Berlin",
        is_active: false,
        status: "ended",
      })
      .select()
      .single();
    if (festivalError || !festival) {
      throw new Error(`Failed to create test festival: ${festivalError?.message}`);
    }

    const { data: attendance, error: attendanceError } = await supabaseAdmin
      .from("attendances")
      .insert({ user_id: existing.user_id, festival_id: festival.id, date: "2024-09-21" })
      .select()
      .single();
    if (attendanceError || !attendance) {
      throw new Error(`Failed to create test attendance: ${attendanceError?.message}`);
    }

    // drinks_total tier 1 unlocks at 3 drinks (see SERIES in
    // packages/shared/src/achievements/definitions.ts).
    const { error: consumptionsError } = await supabaseAdmin.from("consumptions").insert([
      { attendance_id: attendance.id, drink_type: "beer", base_price_cents: 1620, price_paid_cents: 1620, volume_ml: 1000 },
      { attendance_id: attendance.id, drink_type: "beer", base_price_cents: 1620, price_paid_cents: 1620, volume_ml: 1000 },
      { attendance_id: attendance.id, drink_type: "beer", base_price_cents: 1620, price_paid_cents: 1620, volume_ml: 1000 },
    ]);
    if (consumptionsError) {
      throw new Error(`Failed to create test consumptions: ${consumptionsError.message}`);
    }

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    const service = new AchievementService(repo);

    const first = await service.evaluateAndUnlock(existing.user_id, festival.id);
    const second = await service.evaluateAndUnlock(existing.user_id, festival.id);

    expect(first.length).toBeGreaterThan(0);
    expect(first.map((u) => u.slug)).toContain("drinks_total.t1");
    for (const unlock of first) {
      expect(unlock.eventId).toEqual(expect.any(String));
    }
    expect(second).toEqual([]);

    // Cleanup: consumptions, user_achievements and achievement_events all
    // cascade off their FKs, but attendances -> festivals does not (plain
    // FK, no ON DELETE), so the attendance must go before the festival or
    // the festival delete fails.
    await supabaseAdmin.from("attendances").delete().eq("id", attendance.id);
    await supabaseAdmin.from("festivals").delete().eq("id", festival.id);
  });
});
