import type { AchievementMetrics, UnlockedAchievement } from "@prostcounter/shared/achievements";
import { describe, expect, it } from "vitest";

import { AchievementService } from "../achievement.service";

function emptyMetrics(overrides: Partial<AchievementMetrics> = {}): AchievementMetrics {
  return {
    drinks_total: 0,
    drinks_day_max: 0,
    drink_types_distinct: 0,
    volume_ml_total: 0,
    tip_cents_total: 0,
    spend_cents_total: 0,
    days_attended: 0,
    attendance_streak_max: 0,
    tents_distinct: 0,
    groups_joined: 0,
    photos_uploaded: 0,
    reactions_given: 0,
    crowd_reports: 0,
    festivals_attended: 0,
    festival_types_distinct: 0,
    friends_accepted: 0,
    group_wins: 0,
    podium_finishes: 0,
    active_days_total: 0,
    active_day_streak_max: 0,
    attended_opening_day: false,
    attended_closing_day: false,
    attended_every_day: false,
    attended_every_weekend_day: false,
    visited_all_large_tents: false,
    created_group: false,
    logged_first_drink: false,
    uploaded_first_photo: false,
    profile_complete: false,
    wrapped_viewed: false,
    ...overrides,
  };
}

function makeRepo(metrics: AchievementMetrics, held: Set<string> = new Set()) {
  const inserted: UnlockedAchievement[] = [];
  return {
    inserted,
    repo: {
      getMetrics: async () => metrics,
      getHeldSlugs: async () => held,
      insertUnlocks: async (
        _userId: string,
        _festivalId: string,
        unlocks: UnlockedAchievement[],
      ) => {
        inserted.push(...unlocks);
        return unlocks;
      },
    },
  };
}

describe("AchievementService.evaluateAndUnlock", () => {
  it("persists and returns newly earned unlocks", async () => {
    const { repo, inserted } = makeRepo(emptyMetrics({ drinks_total: 3 }));
    const service = new AchievementService(repo as never);

    const result = await service.evaluateAndUnlock("user-1", "festival-1");

    expect(result.map((u) => u.slug)).toContain("drinks_total.t1");
    expect(inserted.map((u) => u.slug)).toContain("drinks_total.t1");
  });

  it("returns an empty array and writes nothing when nothing is earned", async () => {
    const { repo, inserted } = makeRepo(emptyMetrics());
    const service = new AchievementService(repo as never);

    const result = await service.evaluateAndUnlock("user-1", "festival-1");

    expect(result).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it("does not re-unlock what the user already holds", async () => {
    const { repo, inserted } = makeRepo(
      emptyMetrics({ drinks_total: 3 }),
      new Set(["drinks_total.t1"]),
    );
    const service = new AchievementService(repo as never);

    const result = await service.evaluateAndUnlock("user-1", "festival-1");

    expect(result).toEqual([]);
    expect(inserted).toEqual([]);
  });

  it("unlocks every tier crossed in one call", async () => {
    const { repo } = makeRepo(emptyMetrics({ drinks_total: 25 }));
    const service = new AchievementService(repo as never);

    const result = await service.evaluateAndUnlock("user-1", "festival-1");
    const drinkUnlocks = result.filter((u) => u.seriesId === "drinks_total");

    expect(drinkUnlocks).toHaveLength(3);
  });
});

describe("AchievementService.getProgress", () => {
  it("returns progress for every series without writing anything", async () => {
    const { repo, inserted } = makeRepo(emptyMetrics({ drinks_total: 5 }));
    const service = new AchievementService(repo as never);

    const result = await service.getProgress("user-1", "festival-1");

    expect(result.progress.length).toBeGreaterThan(0);
    expect(inserted).toEqual([]);
  });
});
