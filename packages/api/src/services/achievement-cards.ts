import type { RecentUnlock, SeriesCard, SeriesTier } from "@prostcounter/shared";
import type { SeriesProgress } from "@prostcounter/shared/achievements";
import { ONE_OFFS, SERIES, slugFor } from "@prostcounter/shared/achievements";

const DEFAULT_RECENT_UNLOCK_LIMIT = 10;

/** The i18n key holding a slug's display name, e.g. "achievements.drinks_total.t2.name". */
function nameKeyFor(slug: string): string {
  return `achievements.${slug}.name`;
}

/** A rung's slug, recovered from the card it belongs to. One-offs have a single rung. */
function slugForCardTier(card: SeriesCard, tier: SeriesTier): string {
  return card.tiers.length > 1 ? `${card.id}.t${tier.tier}` : card.id;
}

/**
 * Progress toward the rung after the last one the user actually holds.
 *
 * `nextTarget` comes from the definition table indexed by the card's
 * `currentTier` — which counts unlock rows — rather than from
 * `SeriesProgress.nextTarget`, which counts metrics. The two disagree while a
 * metric has passed a target whose unlock row has not been written yet, and
 * the metrics answer would point the card past the rung whose pip is still
 * unfilled.
 *
 * `currentValue` is capped at that target so the same window can never render
 * "30/25", and so no consumer has to clamp a negative remainder.
 */
function buildCardProgress(
  series: (typeof SERIES)[number],
  currentTier: number,
  seriesProgress: SeriesProgress | undefined,
): SeriesCard["progress"] {
  if (seriesProgress === undefined) {
    return null;
  }

  const nextTierDef = series.tiers.find((tierDef) => tierDef.tier === currentTier + 1);
  if (nextTierDef === undefined) {
    return null;
  }

  return {
    currentValue: Math.min(seriesProgress.currentValue, nextTierDef.target),
    nextTarget: nextTierDef.target,
  };
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
 * @param progressBySeriesId seriesId -> live metrics standing, for the 20 series.
 */
export function buildSeriesCards(
  unlockDates: Map<string, string>,
  progressBySeriesId: Map<string, SeriesProgress>,
): SeriesCard[] {
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
      progress: buildCardProgress(series, currentTier, progressBySeriesId.get(series.id)),
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
      // One-offs are binary: there is no partial state to report.
      progress: null,
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
