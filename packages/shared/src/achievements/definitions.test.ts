// packages/shared/src/achievements/definitions.test.ts
import { describe, expect, it } from "vitest";

import { ALL_DEFINITIONS, ALL_SLUGS, ONE_OFFS, SERIES } from "./definitions";
import { isSeries, slugFor } from "./types";
import type { AchievementMetrics } from "./types";

/**
 * A zero-valued instance of AchievementMetrics. Its keys are the source of
 * truth for which metrics exist. If a definition names a metric absent here,
 * the SQL function will never supply it and the achievement is unreachable —
 * which is exactly how the previous engine died.
 */
const METRIC_KEYS: Array<keyof AchievementMetrics> = [
  "drinks_total",
  "drinks_day_max",
  "drink_types_distinct",
  "volume_ml_total",
  "tip_cents_total",
  "spend_cents_total",
  "days_attended",
  "attendance_streak_max",
  "tents_distinct",
  "groups_joined",
  "photos_uploaded",
  "reactions_given",
  "crowd_reports",
  "festivals_attended",
  "festival_types_distinct",
  "friends_accepted",
  "group_wins",
  "podium_finishes",
  "active_days_total",
  "active_day_streak_max",
  "attended_opening_day",
  "attended_closing_day",
  "attended_every_day",
  "attended_every_weekend_day",
  "visited_all_large_tents",
  "created_group",
  "logged_first_drink",
  "uploaded_first_photo",
  "profile_complete",
  "wrapped_viewed",
];

describe("achievement definitions", () => {
  it("has 20 series and 10 one-offs", () => {
    expect(SERIES).toHaveLength(20);
    expect(ONE_OFFS).toHaveLength(10);
    expect(ALL_DEFINITIONS).toHaveLength(30);
  });

  it("produces 90 unlockable slugs", () => {
    expect(ALL_SLUGS).toHaveLength(90);
  });

  it("has no duplicate definition ids", () => {
    const ids = ALL_DEFINITIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate slugs", () => {
    expect(new Set(ALL_SLUGS).size).toBe(ALL_SLUGS.length);
  });

  it("references only metrics that exist", () => {
    for (const def of ALL_DEFINITIONS) {
      expect(METRIC_KEYS).toContain(def.metric);
    }
  });

  it("gives every series exactly four tiers numbered 1..4", () => {
    for (const series of SERIES) {
      expect(series.tiers).toHaveLength(4);
      expect(series.tiers.map((t) => t.tier)).toEqual([1, 2, 3, 4]);
    }
  });

  it("has strictly increasing targets within each series", () => {
    for (const series of SERIES) {
      const targets = series.tiers.map((t) => t.target);
      for (let i = 1; i < targets.length; i++) {
        expect(targets[i]).toBeGreaterThan(targets[i - 1]);
      }
    }
  });

  it("has strictly increasing points within each series", () => {
    for (const series of SERIES) {
      const points = series.tiers.map((t) => t.points);
      for (let i = 1; i < points.length; i++) {
        expect(points[i]).toBeGreaterThan(points[i - 1]);
      }
    }
  });

  it("assigns every definition a non-empty glyph", () => {
    for (const def of ALL_DEFINITIONS) {
      expect(def.glyph.length).toBeGreaterThan(0);
    }
  });

  it("covers all six categories", () => {
    const categories = new Set(ALL_DEFINITIONS.map((d) => d.category));
    expect([...categories].sort()).toEqual([
      "attendance",
      "competitive",
      "dedication",
      "drinking",
      "explorer",
      "social",
    ]);
  });

  it("builds series slugs as <id>.t<tier> and one-off slugs as <id>", () => {
    const series = SERIES[0];
    expect(slugFor(series, 3)).toBe(`${series.id}.t3`);
    expect(slugFor(ONE_OFFS[0])).toBe(ONE_OFFS[0].id);
  });

  it("narrows series and one-offs correctly", () => {
    expect(SERIES.every(isSeries)).toBe(true);
    expect(ONE_OFFS.some(isSeries)).toBe(false);
  });
});
