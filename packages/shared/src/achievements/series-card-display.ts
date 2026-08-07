// packages/shared/src/achievements/series-card-display.ts
import type {
  AchievementRarity,
  AchievementStats,
  BreakdownStats,
  SeriesCard,
  SeriesCategory,
  SeriesTier,
} from "../schemas/achievement.schema";

import { tierToRarity } from "./badge-tokens";

/**
 * Render order of the category sections, shared so web and mobile cannot
 * disagree about it. Keyed as an exhaustive Record rather than a plain array
 * literal so adding a category to `SeriesCategorySchema` without updating
 * this map is a compile error, not a silently-vanishing section on both
 * screens.
 */
const CATEGORY_RENDER_ORDER: Record<SeriesCategory, number> = {
  drinking: 0,
  attendance: 1,
  explorer: 2,
  social: 3,
  competitive: 4,
  dedication: 5,
};

export const SERIES_CATEGORY_ORDER: SeriesCategory[] = (
  Object.keys(CATEGORY_RENDER_ORDER) as SeriesCategory[]
).sort((a, b) => CATEGORY_RENDER_ORDER[a] - CATEGORY_RENDER_ORDER[b]);

/**
 * The rung whose copy and badge the card shows: the highest one unlocked, or
 * the first rung while nothing is unlocked yet.
 *
 * Every user-visible tier value comes from here rather than from
 * `card.currentTier`, which counts rungs cleared. The two agree for the 20
 * tiered series and diverge for the 10 one-offs, whose single rung carries a
 * difficulty tier (`full_festival` is platinum) while `currentTier` is 0 or 1.
 *
 * `currentTier` is clamped to `tiers.length` so a malformed payload (schema
 * validation caught it, this is the runtime backstop) can't index past the
 * end of the array.
 */
export function getActiveTier(card: SeriesCard): SeriesTier {
  const clearedTier = Math.min(card.currentTier, card.tiers.length);
  return clearedTier > 0 ? card.tiers[clearedTier - 1] : card.tiers[0];
}

/** Maxed out: every rung unlocked — all four for a series, the only one for a one-off. */
export function isCardCompleted(card: SeriesCard): boolean {
  return card.tiers.length > 0 && card.currentTier === card.tiers.length;
}

/**
 * Completed / in-progress split, each sorted by rungs cleared, descending.
 *
 * The sort is stable, so cards on the same tier keep the order the API sent
 * them in — which is definition order. That is the whole tie-break; there is
 * no secondary comparator to keep in sync.
 */
export function splitCardsByCompletion(cards: SeriesCard[]): {
  completed: SeriesCard[];
  inProgress: SeriesCard[];
} {
  const completed: SeriesCard[] = [];
  const inProgress: SeriesCard[] = [];

  for (const card of cards) {
    if (isCardCompleted(card)) {
      completed.push(card);
    } else {
      inProgress.push(card);
    }
  }

  const byRungsClearedDesc = (a: SeriesCard, b: SeriesCard) => b.currentTier - a.currentTier;

  return {
    completed: completed.sort(byRungsClearedDesc),
    inProgress: inProgress.sort(byRungsClearedDesc),
  };
}

/** One rail entry: a card plus the numbers the rail prints beside it. */
export interface CloseToUnlockingEntry {
  card: SeriesCard;
  currentValue: number;
  nextTarget: number;
  /** Units still needed for the next rung. Never negative — the API caps currentValue. */
  remaining: number;
  /** 0-100, currentValue as a share of nextTarget, so the bar agrees with the "22/25" text. */
  percentage: number;
}

/**
 * The cards closest to their next rung, nearest first.
 *
 * Ranked by raw remaining count rather than percentage: "3 to go" is a more
 * useful prompt than "88% of the way" regardless of how large the target is.
 * `progress === null` already excludes one-offs and fully cleared series, so
 * there is no separate completion test here.
 *
 * The sort is stable, so cards needing the same amount keep the order the API
 * sent them in — definition order, the same tie-break splitCardsByCompletion uses.
 */
export function selectCloseToUnlocking(cards: SeriesCard[], limit = 3): CloseToUnlockingEntry[] {
  const entries: CloseToUnlockingEntry[] = [];

  for (const card of cards) {
    if (card.progress == null) {
      continue;
    }

    const { currentValue, nextTarget } = card.progress;

    entries.push({
      card,
      currentValue,
      nextTarget,
      remaining: nextTarget - currentValue,
      percentage: Math.round((currentValue / nextTarget) * 100),
    });
  }

  return entries.sort((a, b) => a.remaining - b.remaining).slice(0, limit);
}

function emptyBreakdown(): BreakdownStats {
  return { total: 0, unlocked: 0, points: 0 };
}

/**
 * Totals over rungs, not cards: 90 unlockable slugs across 30 cards. Rarity
 * buckets come from each rung's own tier, so a card contributes to several.
 */
export function buildStats(cards: SeriesCard[]): AchievementStats {
  const breakdownByCategory: Record<SeriesCategory, BreakdownStats> = {
    drinking: emptyBreakdown(),
    attendance: emptyBreakdown(),
    explorer: emptyBreakdown(),
    social: emptyBreakdown(),
    competitive: emptyBreakdown(),
    dedication: emptyBreakdown(),
  };

  const breakdownByRarity: Record<AchievementRarity, BreakdownStats> = {
    common: emptyBreakdown(),
    rare: emptyBreakdown(),
    epic: emptyBreakdown(),
    legendary: emptyBreakdown(),
  };

  let totalAchievements = 0;
  let unlockedAchievements = 0;
  let totalPoints = 0;

  for (const card of cards) {
    const categoryBucket = breakdownByCategory[card.category];

    for (const tier of card.tiers) {
      const rarityBucket = breakdownByRarity[tierToRarity(tier.tier)];

      totalAchievements++;
      categoryBucket.total++;
      rarityBucket.total++;

      if (tier.isUnlocked) {
        unlockedAchievements++;
        totalPoints += tier.points;
        categoryBucket.unlocked++;
        categoryBucket.points += tier.points;
        rarityBucket.unlocked++;
        rarityBucket.points += tier.points;
      }
    }
  }

  return {
    total_achievements: totalAchievements,
    unlocked_achievements: unlockedAchievements,
    total_points: totalPoints,
    breakdown_by_category: breakdownByCategory,
    breakdown_by_rarity: breakdownByRarity,
  };
}
