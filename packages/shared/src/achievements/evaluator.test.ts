// packages/shared/src/achievements/evaluator.test.ts
import { describe, expect, it } from "vitest";

import { SERIES } from "./definitions";
import { evaluate } from "./evaluator";
import type { AchievementMetrics } from "./types";

/** All metrics at zero / false. Override only what a test cares about. */
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

const drinksSeries = SERIES.find((s) => s.id === "drinks_total")!;

describe("evaluate — boundaries", () => {
  it("unlocks nothing at target minus one", () => {
    const result = evaluate(emptyMetrics({ drinks_total: 2 }), new Set());
    expect(result.unlocked.map((u) => u.slug)).not.toContain("drinks_total.t1");
  });

  it("unlocks exactly at target", () => {
    const result = evaluate(emptyMetrics({ drinks_total: 3 }), new Set());
    expect(result.unlocked.map((u) => u.slug)).toContain("drinks_total.t1");
  });

  it("unlocks above target", () => {
    const result = evaluate(emptyMetrics({ drinks_total: 4 }), new Set());
    expect(result.unlocked.map((u) => u.slug)).toContain("drinks_total.t1");
  });
});

describe("evaluate — tier jumping", () => {
  it("unlocks every crossed tier at once", () => {
    const result = evaluate(emptyMetrics({ drinks_total: 25 }), new Set());
    const slugs = result.unlocked.map((u) => u.slug);
    expect(slugs).toContain("drinks_total.t1");
    expect(slugs).toContain("drinks_total.t2");
    expect(slugs).toContain("drinks_total.t3");
    expect(slugs).not.toContain("drinks_total.t4");
  });

  it("unlocks all four tiers when the top target is met", () => {
    const result = evaluate(emptyMetrics({ drinks_total: 50 }), new Set());
    const slugs = result.unlocked.filter((u) => u.seriesId === "drinks_total");
    expect(slugs).toHaveLength(4);
  });
});

describe("evaluate — idempotency", () => {
  it("returns nothing already held", () => {
    const metrics = emptyMetrics({ drinks_total: 25 });
    const first = evaluate(metrics, new Set());
    const held = new Set(first.unlocked.map((u) => u.slug));
    const second = evaluate(metrics, held);
    expect(second.unlocked).toHaveLength(0);
  });

  it("is stable across repeated calls with the same held set", () => {
    const metrics = emptyMetrics({ drinks_total: 10, days_attended: 3 });
    const a = evaluate(metrics, new Set());
    const b = evaluate(metrics, new Set());
    expect(a.unlocked.map((u) => u.slug).sort()).toEqual(b.unlocked.map((u) => u.slug).sort());
  });
});

describe("evaluate — one-offs", () => {
  it("does not unlock a false boolean metric", () => {
    const result = evaluate(emptyMetrics({ attended_opening_day: false }), new Set());
    expect(result.unlocked.map((u) => u.slug)).not.toContain("opening_day");
  });

  it("unlocks a true boolean metric", () => {
    const result = evaluate(emptyMetrics({ attended_opening_day: true }), new Set());
    expect(result.unlocked.map((u) => u.slug)).toContain("opening_day");
  });

  it("reports one-offs with a null seriesId and their declared tier", () => {
    const result = evaluate(emptyMetrics({ attended_every_day: true }), new Set());
    const entry = result.unlocked.find((u) => u.slug === "full_festival");
    expect(entry).toBeDefined();
    expect(entry!.seriesId).toBeNull();
    expect(entry!.tier).toBe(4);
  });

  it("suppresses a one-off the user already holds", () => {
    const result = evaluate(
      emptyMetrics({ attended_opening_day: true }),
      new Set(["opening_day"]),
    );
    expect(result.unlocked.map((u) => u.slug)).not.toContain("opening_day");
  });
});

describe("evaluate — scope separation", () => {
  it("marks lifetime and festival unlocks with their declared scope", () => {
    const result = evaluate(
      emptyMetrics({ drinks_total: 3, friends_accepted: 1 }),
      new Set(),
    );
    const festivalUnlock = result.unlocked.find((u) => u.slug === "drinks_total.t1");
    const lifetimeUnlock = result.unlocked.find((u) => u.slug === "friends_added.t1");
    expect(festivalUnlock!.scope).toBe("festival");
    expect(lifetimeUnlock!.scope).toBe("lifetime");
  });
});

describe("evaluate — progress", () => {
  it("returns one progress entry per series", () => {
    const result = evaluate(emptyMetrics(), new Set());
    expect(result.progress).toHaveLength(SERIES.length);
  });

  it("reports currentTier 0 and the first target when nothing is earned", () => {
    const result = evaluate(emptyMetrics(), new Set());
    const entry = result.progress.find((p) => p.seriesId === "drinks_total")!;
    expect(entry.currentTier).toBe(0);
    expect(entry.nextTarget).toBe(drinksSeries.tiers[0].target);
    expect(entry.currentValue).toBe(0);
    expect(entry.percentage).toBe(0);
  });

  it("reports progress toward the next tier, not from zero", () => {
    // t1 = 3, t2 = 10. At 5 drinks the user is 2/7 of the way from t1 to t2.
    const result = evaluate(emptyMetrics({ drinks_total: 5 }), new Set());
    const entry = result.progress.find((p) => p.seriesId === "drinks_total")!;
    expect(entry.currentTier).toBe(1);
    expect(entry.nextTarget).toBe(10);
    expect(entry.percentage).toBe(29); // round(2 / 7 * 100)
  });

  it("caps at platinum with a null nextTarget and 100 percent", () => {
    const result = evaluate(emptyMetrics({ drinks_total: 999 }), new Set());
    const entry = result.progress.find((p) => p.seriesId === "drinks_total")!;
    expect(entry.currentTier).toBe(4);
    expect(entry.nextTarget).toBeNull();
    expect(entry.percentage).toBe(100);
  });

  it("never reports a percentage outside 0..100", () => {
    const result = evaluate(
      emptyMetrics({ drinks_total: 7, reactions_given: 1_000_000 }),
      new Set(),
    );
    for (const entry of result.progress) {
      expect(entry.percentage).toBeGreaterThanOrEqual(0);
      expect(entry.percentage).toBeLessThanOrEqual(100);
    }
  });

  it("reports progress regardless of what is already unlocked", () => {
    const metrics = emptyMetrics({ drinks_total: 25 });
    const held = new Set(["drinks_total.t1", "drinks_total.t2", "drinks_total.t3"]);
    const result = evaluate(metrics, held);
    const entry = result.progress.find((p) => p.seriesId === "drinks_total")!;
    expect(entry.currentTier).toBe(3);
    expect(entry.nextTarget).toBe(50);
  });
});
