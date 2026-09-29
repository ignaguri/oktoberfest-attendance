import i18next from "i18next";
import { describe, expect, it } from "vitest";

import { buildWrappedStory } from "../../wrapped/story/build-story";
import { PERSONA_IDS } from "../../wrapped/story/persona";
import { makeOfficialStats, makeWrapped } from "../../wrapped/story/story-fixtures";
import type { CopyRef } from "../../wrapped/story/types";
import de from "../locales/de.json";
import en from "../locales/en.json";
import es from "../locales/es.json";

const BUNDLES = { en, de, es } as const;

function lookup(bundle: object, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined,
      bundle,
    );
}

/** A key resolves directly or through i18next's _one/_other plural suffixes. */
function resolves(bundle: object, key: string): boolean {
  return (
    typeof lookup(bundle, key) === "string" ||
    (typeof lookup(bundle, `${key}_one`) === "string" && typeof lookup(bundle, `${key}_other`) === "string")
  );
}

function leafKeys(node: unknown, prefix: string): string[] {
  if (typeof node === "string") {
    return [prefix];
  }
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    leafKeys(value, `${prefix}.${key}`),
  );
}

/** Every CopyRef anywhere inside a slide (nested objects and arrays included). */
function copyRefs(node: unknown): CopyRef[] {
  if (Array.isArray(node)) {
    return node.flatMap(copyRefs);
  }
  if (node && typeof node === "object") {
    if ("key" in node && typeof (node as { key: unknown }).key === "string") {
      return [node as CopyRef];
    }
    return Object.values(node).flatMap(copyRefs);
  }
  return [];
}

const STORIES = [
  buildWrappedStory(makeWrapped(), makeOfficialStats()),
  buildWrappedStory(makeWrapped(), makeOfficialStats({ year: 2025, isCurrentFestival: false, sourceUrl: null })),
  buildWrappedStory(makeWrapped((data) => { data.basicStats.totalBeers = 2; }), null),
  buildWrappedStory(
    makeWrapped((data) => {
      data.basicStats.totalBeers = 0;
      data.comparisons.vsFestivalAvg.beersPercentile = 20;
      data.comparisons.vsLastYear = null;
    }),
    null,
  ),
];

describe("Wrapped story copy", () => {
  it("has every en story key in de and es", () => {
    const keys = leafKeys(lookup(en, "wrapped.story"), "wrapped.story");
    expect(keys.length).toBeGreaterThan(50);
    for (const bundle of [de, es]) {
      for (const key of keys) {
        expect(typeof lookup(bundle, key), key).toBe("string");
      }
    }
  });

  it("resolves every key the builder emits, in every locale", () => {
    const keys = new Set(copyRefs(STORIES).map((ref) => ref.key));
    for (const [locale, bundle] of Object.entries(BUNDLES)) {
      for (const key of keys) {
        expect(resolves(bundle, key), `${locale}: ${key}`).toBe(true);
      }
    }
  });

  it("has a description and a because line for every persona", () => {
    for (const [locale, bundle] of Object.entries(BUNDLES)) {
      for (const id of PERSONA_IDS) {
        expect(resolves(bundle, `wrapped.story.persona.${id}.description`), `${locale} ${id}`).toBe(true);
        expect(resolves(bundle, `wrapped.story.persona.${id}.because`), `${locale} ${id}`).toBe(true);
      }
    }
  });

  // Most visitors log 1-3 beers, so the singular is the common case, not an edge.
  it.each([
    ["en", "1 beer", "1 beers"],
    ["de", "1 Bier", "1 Biere"],
    ["es", "1 cerveza", "1 cervezas"],
  ] as const)("says one beer in the singular in %s", async (locale, singular, broken) => {
    const i18n = i18next.createInstance();
    await i18n.init({ resources: { [locale]: { translation: BUNDLES[locale] } }, lng: locale, interpolation: { escapeValue: false } });
    const lines = [
      i18n.t("wrapped.story.days.best", { beers: 1 }),
      i18n.t("wrapped.story.persona.geniesser.because", { count: 1, beers: 1 }),
      i18n.t("wrapped.story.persona.geniesser.because", { count: 3, beers: 1 }),
    ];
    for (const line of lines) {
      expect(line).toContain(singular);
      expect(line).not.toContain(broken);
    }
  });

  it.each([
    ["en", "Your one beer was", "Your one beer would have been", "Your 3 beers were"],
    ["de", "Dein eines Bier war", "Dein eines Bier wäre", "Deine 3 Biere waren"],
    ["es", "Tu única cerveza fue", "Tu única cerveza habría sido", "Tus 3 cervezas fueron"],
  ] as const)("agrees the share line with the beer count in %s", async (locale, current, lastYear, plural) => {
    const i18n = i18next.createInstance();
    await i18n.init({ resources: { [locale]: { translation: BUNDLES[locale] } }, lng: locale, interpolation: { escapeValue: false } });
    const params = { pct: 0.01, mass: 7000000 };
    expect(i18n.t("wrapped.story.wiesnAndYou.share.current", { count: 1, ...params })).toMatch(new RegExp(`^${current} `));
    expect(i18n.t("wrapped.story.wiesnAndYou.share.lastYear", { count: 1, ...params })).toMatch(new RegExp(`^${lastYear} `));
    expect(i18n.t("wrapped.story.wiesnAndYou.share.current", { count: 3, ...params })).toMatch(new RegExp(`^${plural} `));
  });

  it("has the admin official-stats keys", () => {
    const keys = leafKeys(
      lookup(en, "admin.mobile.festivalDetail.officialStats"),
      "admin.mobile.festivalDetail.officialStats",
    ).concat([
      "admin.mobile.festivalDetail.officialStatsLink",
      "admin.mobile.festivalDetail.officialStatsLinkHint",
    ]);
    for (const bundle of [de, es]) {
      for (const key of keys) {
        expect(typeof lookup(bundle, key), key).toBe("string");
      }
    }
  });
});
