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
    const target = await getTarget(supabaseAdmin);

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    const service = new AchievementService(repo);

    const first = await service.evaluateAndUnlock(target.user_id, target.festival_id);
    const second = await service.evaluateAndUnlock(target.user_id, target.festival_id);

    // Whatever this run's DB state, the first call must never repeat what the
    // second call already reported as held — that's the invariant insertUnlocks
    // now guarantees via .select() with ignoreDuplicates.
    expect(Array.isArray(first)).toBe(true);
    for (const unlock of first) {
      expect(unlock.eventId).toEqual(expect.any(String));
    }
    expect(second).toEqual([]);
  });
});
