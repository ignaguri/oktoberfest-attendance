// packages/shared/src/achievements/evaluator.ts
import { ALL_DEFINITIONS, SERIES } from "./definitions";
import { isSeries, slugFor } from "./types";
import type {
  AchievementMetrics,
  AchievementTier,
  SeriesProgress,
  UnlockedAchievement,
} from "./types";

export interface EvaluationResult {
  /** Newly earned achievements, excluding anything in alreadyUnlocked. */
  unlocked: UnlockedAchievement[];
  /** Current standing of every series, independent of what is already unlocked. */
  progress: SeriesProgress[];
}

/**
 * Compare a user's metrics against every definition.
 *
 * Pure: no I/O, no clock, no randomness. Same inputs always give same outputs.
 *
 * @param metrics        Every metric for one (user, festival) pair.
 * @param alreadyUnlocked Slugs the user already holds. Used only to suppress
 *                        re-reporting; it never affects progress calculation.
 */
export function evaluate(
  metrics: AchievementMetrics,
  alreadyUnlocked: Set<string>,
): EvaluationResult {
  const unlocked: UnlockedAchievement[] = [];

  for (const definition of ALL_DEFINITIONS) {
    if (isSeries(definition)) {
      const value = metrics[definition.metric];
      for (const tierDef of definition.tiers) {
        if (value < tierDef.target) {
          continue;
        }
        const slug = slugFor(definition, tierDef.tier);
        if (alreadyUnlocked.has(slug)) {
          continue;
        }
        unlocked.push({
          slug,
          seriesId: definition.id,
          tier: tierDef.tier,
          category: definition.category,
          scope: definition.scope,
          glyph: definition.glyph,
          points: tierDef.points,
        });
      }
    } else {
      if (!metrics[definition.metric]) {
        continue;
      }
      const slug = slugFor(definition);
      if (alreadyUnlocked.has(slug)) {
        continue;
      }
      unlocked.push({
        slug,
        seriesId: null,
        tier: definition.tier,
        category: definition.category,
        scope: definition.scope,
        glyph: definition.glyph,
        points: definition.points,
      });
    }
  }

  const progress: SeriesProgress[] = SERIES.map((series) => {
    const currentValue = metrics[series.metric];

    let currentTier = 0;
    for (const tierDef of series.tiers) {
      if (currentValue >= tierDef.target) {
        currentTier = tierDef.tier;
      }
    }

    const nextTierDef = series.tiers.find((tierDef) => tierDef.tier === currentTier + 1);

    if (nextTierDef === undefined) {
      return {
        seriesId: series.id,
        category: series.category,
        scope: series.scope,
        glyph: series.glyph,
        currentTier,
        nextTarget: null,
        currentValue,
        percentage: 100,
      };
    }

    // Progress is measured from the tier just cleared, not from zero, so the
    // bar restarts on each unlock instead of creeping asymptotically.
    const floor = currentTier === 0 ? 0 : series.tiers[currentTier - 1].target;
    const span = nextTierDef.target - floor;
    const gained = currentValue - floor;
    const percentage = span <= 0 ? 100 : clampPercentage(Math.round((gained / span) * 100));

    return {
      seriesId: series.id,
      category: series.category,
      scope: series.scope,
      glyph: series.glyph,
      currentTier,
      nextTarget: nextTierDef.target,
      currentValue,
      percentage,
    };
  });

  return { unlocked, progress };
}

function clampPercentage(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

/** Highest tier held for a series, derived from a set of slugs. 0 if none. */
export function highestTierFor(seriesId: string, heldSlugs: Set<string>): number {
  let highest = 0;
  for (const tier of [1, 2, 3, 4] as AchievementTier[]) {
    if (heldSlugs.has(`${seriesId}.t${tier}`)) {
      highest = tier;
    }
  }
  return highest;
}
