import { describe, expect, it } from "vitest";

import { GetAchievementsWithProgressResponseSchema, SeriesCardSchema } from "./achievement.schema";

const validCard = {
  id: "drinks_total",
  category: "drinking",
  scope: "festival",
  glyph: "masskrug",
  currentTier: 2,
  tiers: [
    {
      tier: 1,
      name: "achievements.drinks_total.t1.name",
      points: 10,
      isUnlocked: true,
      unlockedAt: "2026-09-20T10:00:00Z",
    },
    {
      tier: 2,
      name: "achievements.drinks_total.t2.name",
      points: 50,
      isUnlocked: true,
      unlockedAt: "2026-09-21T10:00:00Z",
    },
    {
      tier: 3,
      name: "achievements.drinks_total.t3.name",
      points: 150,
      isUnlocked: false,
      unlockedAt: null,
    },
    {
      tier: 4,
      name: "achievements.drinks_total.t4.name",
      points: 400,
      isUnlocked: false,
      unlockedAt: null,
    },
  ],
  progress: { currentValue: 12, nextTarget: 25 },
};

const emptyBreakdown = { total: 0, unlocked: 0, points: 0 };

const validStats = {
  total_achievements: 90,
  unlocked_achievements: 2,
  total_points: 60,
  breakdown_by_category: {
    drinking: emptyBreakdown,
    attendance: emptyBreakdown,
    explorer: emptyBreakdown,
    social: emptyBreakdown,
    competitive: emptyBreakdown,
    dedication: emptyBreakdown,
  },
  breakdown_by_rarity: {
    common: emptyBreakdown,
    rare: emptyBreakdown,
    epic: emptyBreakdown,
    legendary: emptyBreakdown,
  },
};

describe("SeriesCardSchema", () => {
  it("accepts a four-tier series card", () => {
    expect(SeriesCardSchema.parse(validCard)).toEqual(validCard);
  });

  it("accepts a one-off card with a single tier", () => {
    const oneOff = {
      id: "first_drink",
      category: "drinking",
      scope: "lifetime",
      glyph: "first-drop",
      currentTier: 1,
      tiers: [
        {
          tier: 1,
          name: "achievements.first_drink.name",
          points: 10,
          isUnlocked: true,
          unlockedAt: "2026-09-20T10:00:00Z",
        },
      ],
      progress: null,
    };
    expect(SeriesCardSchema.parse(oneOff)).toEqual(oneOff);
  });

  it("accepts currentTier 0 for an untouched card", () => {
    expect(SeriesCardSchema.parse({ ...validCard, currentTier: 0 }).currentTier).toBe(0);
  });

  it("rejects a legacy category value", () => {
    expect(SeriesCardSchema.safeParse({ ...validCard, category: "consumption" }).success).toBe(
      false,
    );
  });

  it("rejects a currentTier above 4", () => {
    expect(SeriesCardSchema.safeParse({ ...validCard, currentTier: 5 }).success).toBe(false);
  });

  it("accepts a null progress for a card with nothing left to earn", () => {
    expect(SeriesCardSchema.parse({ ...validCard, progress: null }).progress).toBeNull();
  });

  it("rejects a missing progress field", () => {
    const withoutProgress = { ...validCard, progress: undefined };
    expect(SeriesCardSchema.safeParse(withoutProgress).success).toBe(false);
  });

  it("rejects a non-positive nextTarget", () => {
    expect(
      SeriesCardSchema.safeParse({
        ...validCard,
        progress: { currentValue: 0, nextTarget: 0 },
      }).success,
    ).toBe(false);
  });

  it("rejects a currentValue above nextTarget", () => {
    expect(
      SeriesCardSchema.safeParse({
        ...validCard,
        progress: { currentValue: 30, nextTarget: 25 },
      }).success,
    ).toBe(false);
  });
});

describe("GetAchievementsWithProgressResponseSchema", () => {
  it("accepts a cards + recentUnlocks + stats payload", () => {
    const parsed = GetAchievementsWithProgressResponseSchema.parse({
      cards: [validCard],
      recentUnlocks: [
        {
          id: "drinks_total.t2",
          name: "achievements.drinks_total.t2.name",
          glyph: "masskrug",
          category: "drinking",
          tier: 2,
          scope: "festival",
          points: 50,
          unlockedAt: "2026-09-21T10:00:00Z",
        },
      ],
      stats: validStats,
    });

    expect(parsed.cards).toHaveLength(1);
    expect(parsed.recentUnlocks[0].id).toBe("drinks_total.t2");
    expect(parsed.stats.total_achievements).toBe(90);
  });
});
