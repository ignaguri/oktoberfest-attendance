import { ONE_OFFS, SERIES } from "@prostcounter/shared/achievements";
import { describe, expect, it } from "vitest";

import { buildRecentUnlocks, buildSeriesCards, buildStats } from "../achievement-cards";

describe("buildSeriesCards", () => {
  it("returns one card per definition, series first, in definition order", () => {
    const cards = buildSeriesCards(new Map());

    expect(cards).toHaveLength(SERIES.length + ONE_OFFS.length);
    expect(cards.slice(0, SERIES.length).map((card) => card.id)).toEqual(
      SERIES.map((series) => series.id),
    );
    expect(cards.slice(SERIES.length).map((card) => card.id)).toEqual(
      ONE_OFFS.map((oneOff) => oneOff.id),
    );
  });

  it("gives an untouched series four locked rungs and currentTier 0", () => {
    const card = buildSeriesCards(new Map()).find((entry) => entry.id === "drinks_total");

    expect(card?.currentTier).toBe(0);
    expect(card?.tiers).toHaveLength(4);
    expect(card?.tiers.every((tier) => !tier.isUnlocked && tier.unlockedAt === null)).toBe(true);
    expect(card?.tiers[1].name).toBe("achievements.drinks_total.t2.name");
    expect(card?.tiers[1].points).toBe(50);
  });

  it("sets currentTier to the highest unlocked rung", () => {
    const unlockDates = new Map([
      ["drinks_total.t1", "2026-09-20T10:00:00Z"],
      ["drinks_total.t2", "2026-09-21T10:00:00Z"],
    ]);

    const card = buildSeriesCards(unlockDates).find((entry) => entry.id === "drinks_total");

    expect(card?.currentTier).toBe(2);
    expect(card?.tiers.map((tier) => tier.isUnlocked)).toEqual([true, true, false, false]);
    expect(card?.tiers[0].unlockedAt).toBe("2026-09-20T10:00:00Z");
  });

  it("sets currentTier to 4 for a fully unlocked series", () => {
    const unlockDates = new Map(
      [1, 2, 3, 4].map((tier) => [`drinks_total.t${tier}`, "2026-09-20T10:00:00Z"] as const),
    );

    expect(buildSeriesCards(unlockDates).find((entry) => entry.id === "drinks_total")?.currentTier).toBe(4);
  });

  it("maps a one-off to a single-rung card keeping its difficulty tier", () => {
    const locked = buildSeriesCards(new Map()).find((entry) => entry.id === "full_festival");

    expect(locked?.tiers).toHaveLength(1);
    expect(locked?.currentTier).toBe(0);
    expect(locked?.tiers[0].tier).toBe(4);
    expect(locked?.tiers[0].name).toBe("achievements.full_festival.name");

    const unlocked = buildSeriesCards(
      new Map([["full_festival", "2026-10-05T10:00:00Z"]]),
    ).find((entry) => entry.id === "full_festival");

    expect(unlocked?.currentTier).toBe(1);
    expect(unlocked?.tiers[0].isUnlocked).toBe(true);
    expect(unlocked?.tiers[0].unlockedAt).toBe("2026-10-05T10:00:00Z");
  });
});

describe("buildRecentUnlocks", () => {
  it("returns nothing when nothing is unlocked", () => {
    expect(buildRecentUnlocks(buildSeriesCards(new Map()))).toEqual([]);
  });

  it("sorts newest first and keys each unlock by its slug", () => {
    const unlockDates = new Map([
      ["drinks_total.t1", "2026-09-20T10:00:00Z"],
      ["drinks_total.t2", "2026-09-22T10:00:00Z"],
      ["first_drink", "2026-09-21T10:00:00Z"],
    ]);

    const recent = buildRecentUnlocks(buildSeriesCards(unlockDates));

    expect(recent.map((unlock) => unlock.id)).toEqual([
      "drinks_total.t2",
      "first_drink",
      "drinks_total.t1",
    ]);
    expect(recent[0]).toMatchObject({
      name: "achievements.drinks_total.t2.name",
      glyph: "masskrug",
      category: "drinking",
      tier: 2,
      scope: "festival",
      points: 50,
    });
  });

  it("caps the list at the limit", () => {
    const unlockDates = new Map(
      SERIES.slice(0, 12).map(
        (series, index) => [`${series.id}.t1`, `2026-09-${10 + index}T10:00:00Z`] as const,
      ),
    );

    expect(buildRecentUnlocks(buildSeriesCards(unlockDates))).toHaveLength(10);
    expect(buildRecentUnlocks(buildSeriesCards(unlockDates), 3)).toHaveLength(3);
  });
});

describe("buildStats", () => {
  it("counts every rung, not every card", () => {
    const stats = buildStats(buildSeriesCards(new Map()));

    expect(stats.total_achievements).toBe(SERIES.length * 4 + ONE_OFFS.length);
    expect(stats.unlocked_achievements).toBe(0);
    expect(stats.total_points).toBe(0);
  });

  it("has exactly the six live category buckets", () => {
    const stats = buildStats(buildSeriesCards(new Map()));

    expect(Object.keys(stats.breakdown_by_category).sort()).toEqual([
      "attendance",
      "competitive",
      "dedication",
      "drinking",
      "explorer",
      "social",
    ]);
  });

  it("accumulates unlocked counts and points into both breakdowns", () => {
    const unlockDates = new Map([
      ["drinks_total.t1", "2026-09-20T10:00:00Z"],
      ["drinks_total.t2", "2026-09-21T10:00:00Z"],
      ["full_festival", "2026-10-05T10:00:00Z"],
    ]);

    const stats = buildStats(buildSeriesCards(unlockDates));

    expect(stats.unlocked_achievements).toBe(3);
    expect(stats.total_points).toBe(10 + 50 + 600);
    expect(stats.breakdown_by_category.drinking).toMatchObject({ unlocked: 2, points: 60 });
    expect(stats.breakdown_by_category.attendance).toMatchObject({ unlocked: 1, points: 600 });
    expect(stats.breakdown_by_rarity.common).toMatchObject({ unlocked: 1, points: 10 });
    expect(stats.breakdown_by_rarity.rare).toMatchObject({ unlocked: 1, points: 50 });
    expect(stats.breakdown_by_rarity.legendary).toMatchObject({ unlocked: 1, points: 600 });
  });
});
