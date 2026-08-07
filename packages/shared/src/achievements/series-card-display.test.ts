import type { SeriesCard } from "../schemas/achievement.schema";
import { describe, expect, it } from "vitest";

import { tierToRarity } from "./badge-tokens";
import {
  getActiveTier,
  isCardCompleted,
  SERIES_CATEGORY_ORDER,
  splitCardsByCompletion,
} from "./series-card-display";

function seriesCard(id: string, currentTier: number): SeriesCard {
  return {
    id,
    category: "drinking",
    scope: "festival",
    glyph: "masskrug",
    currentTier,
    tiers: [1, 2, 3, 4].map((tier) => ({
      tier,
      name: `achievements.${id}.t${tier}.name`,
      points: tier * 10,
      isUnlocked: tier <= currentTier,
      unlockedAt: tier <= currentTier ? "2026-09-20T10:00:00Z" : null,
    })),
  };
}

function oneOffCard(id: string, difficulty: number, unlocked: boolean): SeriesCard {
  return {
    id,
    category: "attendance",
    scope: "festival",
    glyph: "wiesn-crown",
    currentTier: unlocked ? 1 : 0,
    tiers: [
      {
        tier: difficulty,
        name: `achievements.${id}.name`,
        points: 600,
        isUnlocked: unlocked,
        unlockedAt: unlocked ? "2026-09-20T10:00:00Z" : null,
      },
    ],
  };
}

describe("SERIES_CATEGORY_ORDER", () => {
  it("lists the six live categories in render order", () => {
    expect(SERIES_CATEGORY_ORDER).toEqual([
      "drinking",
      "attendance",
      "explorer",
      "social",
      "competitive",
      "dedication",
    ]);
  });
});

describe("getActiveTier", () => {
  it("returns the first rung when nothing is unlocked", () => {
    expect(getActiveTier(seriesCard("drinks_total", 0)).tier).toBe(1);
  });

  it("returns the highest unlocked rung mid-series", () => {
    expect(getActiveTier(seriesCard("drinks_total", 2)).name).toBe(
      "achievements.drinks_total.t2.name",
    );
  });

  it("returns the top rung when maxed out", () => {
    expect(getActiveTier(seriesCard("drinks_total", 4)).tier).toBe(4);
  });

  it("returns a one-off's own difficulty tier, not its currentTier", () => {
    expect(getActiveTier(oneOffCard("full_festival", 4, true)).tier).toBe(4);
    expect(getActiveTier(oneOffCard("full_festival", 4, false)).tier).toBe(4);
  });
});

describe("isCardCompleted", () => {
  it("is false while rungs remain", () => {
    expect(isCardCompleted(seriesCard("drinks_total", 3))).toBe(false);
  });

  it("is true once every rung is unlocked", () => {
    expect(isCardCompleted(seriesCard("drinks_total", 4))).toBe(true);
  });

  it("is true for an unlocked one-off and false for a locked one", () => {
    expect(isCardCompleted(oneOffCard("full_festival", 4, true))).toBe(true);
    expect(isCardCompleted(oneOffCard("full_festival", 4, false))).toBe(false);
  });
});

describe("splitCardsByCompletion", () => {
  it("separates maxed cards from everything else", () => {
    const { completed, inProgress } = splitCardsByCompletion([
      seriesCard("a", 4),
      seriesCard("b", 0),
      seriesCard("c", 2),
    ]);

    expect(completed.map((card) => card.id)).toEqual(["a"]);
    expect(inProgress.map((card) => card.id)).toEqual(["c", "b"]);
  });

  it("keeps the input order between cards on the same tier", () => {
    const { inProgress } = splitCardsByCompletion([
      seriesCard("first", 1),
      seriesCard("second", 1),
      seriesCard("third", 1),
    ]);

    expect(inProgress.map((card) => card.id)).toEqual(["first", "second", "third"]);
  });
});

describe("tierToRarity", () => {
  it("maps each tier onto the rarity vocabulary", () => {
    expect(tierToRarity(1)).toBe("common");
    expect(tierToRarity(2)).toBe("rare");
    expect(tierToRarity(3)).toBe("epic");
    expect(tierToRarity(4)).toBe("legendary");
  });

  it("falls back to common for missing tiers", () => {
    expect(tierToRarity(null)).toBe("common");
    expect(tierToRarity(undefined)).toBe("common");
  });
});
