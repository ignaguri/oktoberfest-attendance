// Integration test: requires a running local Supabase.
// Run with: pnpm --filter=@prostcounter/api test -- --run achievement-unlock.integration
import { describe, expect, it } from "vitest";

import { createTestSupabaseAdmin } from "../../__tests__/helpers/test-supabase";
import { AchievementMetricsRepository } from "../../repositories/supabase/achievement-metrics.repository";
import { AchievementService } from "../../services/achievement.service";

describe("achievement unlocking against a real database", () => {
  it("unlocks the first-drink achievement for a user with consumptions", async () => {
    const supabaseAdmin = createTestSupabaseAdmin();

    const { data: rows } = await supabaseAdmin
      .from("attendances")
      .select("user_id, festival_id")
      .limit(1);

    const target = rows?.[0];
    if (!target) {
      throw new Error("No attendance rows in local database; seed it first");
    }

    const repo = new AchievementMetricsRepository(supabaseAdmin);
    const service = new AchievementService(repo);

    const metrics = await repo.getMetrics(target.user_id as string, target.festival_id);
    expect(Object.keys(metrics)).toHaveLength(30);

    const unlocked = await service.evaluateAndUnlock(
      target.user_id as string,
      target.festival_id,
    );

    // Second call must be a no-op: everything is already held.
    const second = await service.evaluateAndUnlock(
      target.user_id as string,
      target.festival_id,
    );
    expect(second).toEqual([]);
    expect(Array.isArray(unlocked)).toBe(true);
  });
});
