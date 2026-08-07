import type {
  AchievementRarity,
  AchievementStats,
  BreakdownStats,
  RecentUnlock,
  SeriesCard,
  SeriesCategory,
  SeriesTier,
} from "@prostcounter/shared";
import { ONE_OFFS, SERIES, slugFor, tierToRarity } from "@prostcounter/shared/achievements";

const DEFAULT_RECENT_UNLOCK_LIMIT = 10;

/** The i18n key holding a slug's display name, e.g. "achievements.drinks_total.t2.name". */
function nameKeyFor(slug: string): string {
  return `achievements.${slug}.name`;
}

/** A rung's slug, recovered from the card it belongs to. One-offs have a single rung. */
function slugForCardTier(card: SeriesCard, tier: SeriesTier): string {
  return card.tiers.length > 1 ? `${card.id}.t${tier.tier}` : card.id;
}

function emptyBreakdown(): BreakdownStats {
  return { total: 0, unlocked: 0, points: 0 };
}

/**
 * One card per definition: the 20 tiered series, then the 10 one-offs.
 *
 * The order is part of the contract — both apps sort cards by rungs cleared
 * with a stable sort and rely on this order as the tie-break — so nothing
 * here may group, filter or re-sort.
 *
 * `currentTier` counts rungs the user actually holds rather than rungs their
 * raw metrics would earn, so it can never contradict the per-rung
 * `isUnlocked` flags the pips render.
 *
 * @param unlockDates slug -> ISO unlock timestamp, for slugs the user holds.
 */
export function buildSeriesCards(unlockDates: Map<string, string>): SeriesCard[] {
  const seriesCards: SeriesCard[] = SERIES.map((series) => {
    const tiers: SeriesTier[] = series.tiers.map((tierDef) => {
      const unlockedAt = unlockDates.get(slugFor(series, tierDef.tier)) ?? null;
      return {
        tier: tierDef.tier,
        name: nameKeyFor(slugFor(series, tierDef.tier)),
        points: tierDef.points,
        isUnlocked: unlockedAt !== null,
        unlockedAt,
      };
    });

    let currentTier = 0;
    for (const tier of tiers) {
      if (tier.isUnlocked) {
        currentTier = tier.tier;
      }
    }

    return {
      id: series.id,
      category: series.category,
      scope: series.scope,
      glyph: series.glyph,
      currentTier,
      tiers,
    };
  });

  const oneOffCards: SeriesCard[] = ONE_OFFS.map((oneOff) => {
    const slug = slugFor(oneOff);
    const unlockedAt = unlockDates.get(slug) ?? null;

    return {
      id: oneOff.id,
      category: oneOff.category,
      scope: oneOff.scope,
      glyph: oneOff.glyph,
      // Rungs cleared, not difficulty — the difficulty stays on the rung below.
      currentTier: unlockedAt !== null ? 1 : 0,
      tiers: [
        {
          tier: oneOff.tier,
          name: nameKeyFor(slug),
          points: oneOff.points,
          isUnlocked: unlockedAt !== null,
          unlockedAt,
        },
      ],
    };
  });

  return [...seriesCards, ...oneOffCards];
}

/** Every unlocked rung across every card, newest first, capped. */
export function buildRecentUnlocks(
  cards: SeriesCard[],
  limit: number = DEFAULT_RECENT_UNLOCK_LIMIT,
): RecentUnlock[] {
  const unlocks: RecentUnlock[] = [];

  for (const card of cards) {
    for (const tier of card.tiers) {
      if (!tier.isUnlocked || tier.unlockedAt === null) {
        continue;
      }

      unlocks.push({
        id: slugForCardTier(card, tier),
        name: tier.name,
        glyph: card.glyph,
        category: card.category,
        tier: tier.tier,
        scope: card.scope,
        points: tier.points,
        unlockedAt: tier.unlockedAt,
      });
    }
  }

  unlocks.sort((a, b) => Date.parse(b.unlockedAt) - Date.parse(a.unlockedAt));

  return unlocks.slice(0, limit);
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
