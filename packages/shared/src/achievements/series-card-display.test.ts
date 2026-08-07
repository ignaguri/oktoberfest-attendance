import type { SeriesCard } from "../schemas/achievement.schema";
import { describe, expect, it } from "vitest";

import { tierToRarity } from "./badge-tokens";
import {
  getActiveTier,
  isCardCompleted,
  SERIES_CATEGORY_ORDER,
  selectCloseToUnlocking,
  splitCardsByCompletion,
} from "./series-card-display";

function seriesCard(
  id: string,
  currentTier: number,
  progress: SeriesCard["progress"] = null,
): SeriesCard {
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
    progress,
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
    progress: null,
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

describe("selectCloseToUnlocking", () => {
  it("returns nothing when no card has progress", () => {
    expect(selectCloseToUnlocking([seriesCard("a", 0), oneOffCard("b", 4, false)])).toEqual([]);
  });

  it("skips one-offs and fully cleared series", () => {
    const entries = selectCloseToUnlocking([
      oneOffCard("one_off", 4, false),
      seriesCard("maxed", 4),
      seriesCard("live", 1, { currentValue: 8, nextTarget: 10 }),
    ]);

    expect(entries.map((entry) => entry.card.id)).toEqual(["live"]);
  });

  it("ranks by remaining count ascending, not by percentage", () => {
    const entries = selectCloseToUnlocking([
      seriesCard("far", 0, { currentValue: 90, nextTarget: 100 }),
      seriesCard("near", 0, { currentValue: 1, nextTarget: 4 }),
    ]);

    expect(entries.map((entry) => entry.card.id)).toEqual(["near", "far"]);
    expect(entries.map((entry) => entry.remaining)).toEqual([3, 10]);
  });

  it("keeps the input order between cards with the same remaining count", () => {
    const entries = selectCloseToUnlocking([
      seriesCard("first", 0, { currentValue: 2, nextTarget: 5 }),
      seriesCard("second", 0, { currentValue: 7, nextTarget: 10 }),
    ]);

    expect(entries.map((entry) => entry.card.id)).toEqual(["first", "second"]);
  });

  it("caps the list at three by default and honours an explicit limit", () => {
    const cards = [1, 2, 3, 4, 5].map((index) =>
      seriesCard(`s${index}`, 0, { currentValue: 0, nextTarget: index }),
    );

    expect(selectCloseToUnlocking(cards)).toHaveLength(3);
    expect(selectCloseToUnlocking(cards, 1).map((entry) => entry.card.id)).toEqual(["s1"]);
  });

  it("reports the percentage as the share of the next target", () => {
    const [entry] = selectCloseToUnlocking([
      seriesCard("live", 1, { currentValue: 22, nextTarget: 25 }),
    ]);

    expect(entry.percentage).toBe(88);
    expect(entry.currentValue).toBe(22);
    expect(entry.nextTarget).toBe(25);
  });
});
