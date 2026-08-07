// packages/shared/src/achievements/series-card-display.ts
import type { SeriesCard, SeriesCategory, SeriesTier } from "../schemas/achievement.schema";

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
 */
export function getActiveTier(card: SeriesCard): SeriesTier {
  return card.currentTier > 0 ? card.tiers[card.currentTier - 1] : card.tiers[0];
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
