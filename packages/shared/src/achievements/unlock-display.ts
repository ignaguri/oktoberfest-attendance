import { ONE_OFFS, SERIES } from "./definitions";
import { slugFor } from "./types";
import type { UnlockedAchievement } from "./types";

/** The i18n key holding a slug's display name, e.g. "achievements.drinks_total.t2.name". */
export function nameKeyFor(slug: string): string {
  return `achievements.${slug}.name`;
}

/**
 * Every slug the definitions know about, mapped to the data an unlock renders
 * with. Built once at module load rather than searched per call: the toast
 * resolves a slug on every unlock, and the table is a fixed 90 entries.
 *
 * Field-for-field identical to what the evaluator emits for the same slug (see
 * evaluator.ts) — deliberately, so an unlock read back from the outbox is
 * indistinguishable from one returned inline by the write that caused it.
 */
const DESCRIPTOR_BY_SLUG: ReadonlyMap<string, UnlockedAchievement> = (() => {
  const descriptors = new Map<string, UnlockedAchievement>();

  for (const series of SERIES) {
    for (const tierDef of series.tiers) {
      const slug = slugFor(series, tierDef.tier);
      descriptors.set(slug, {
        slug,
        seriesId: series.id,
        tier: tierDef.tier,
        category: series.category,
        scope: series.scope,
        glyph: series.glyph,
        points: tierDef.points,
      });
    }
  }

  for (const oneOff of ONE_OFFS) {
    descriptors.set(oneOff.id, {
      slug: oneOff.id,
      seriesId: null,
      tier: oneOff.tier,
      category: oneOff.category,
      scope: oneOff.scope,
      glyph: oneOff.glyph,
      points: oneOff.points,
    });
  }

  return descriptors;
})();

/**
 * The renderable form of an unlock, from the TS definitions rather than the
 * registry table (master-doc decision D3: definitions are the source of truth).
 *
 * Null means the slug belongs to no definition — registry drift the caller must
 * log rather than render.
 */
export function describeUnlock(slug: string): UnlockedAchievement | null {
  return DESCRIPTOR_BY_SLUG.get(slug) ?? null;
}
