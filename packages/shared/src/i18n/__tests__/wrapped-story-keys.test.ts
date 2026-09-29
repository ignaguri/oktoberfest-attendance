import i18next from "i18next";
import { describe, expect, it } from "vitest";

import { buildWrappedStory } from "../../wrapped/story/build-story";
import { PERSONA_IDS } from "../../wrapped/story/persona";
import { makeOfficialStats, makeWrapped } from "../../wrapped/story/story-fixtures";
import { slideSummaryText } from "../../wrapped/story/summary";
import type { WrappedData } from "../../schemas/wrapped.schema";
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
    ["en", "Maß poured was your one beer", "Maß last year would have been your one beer", "Maß poured was one of your 3 beers"],
    ["de", "ausgeschenkten Maß war dein eines Bier", "Maß vom letzten Jahr wäre dein eines Bier gewesen", "ausgeschenkten Maß war eins deiner 3 Biere"],
    ["es", "Maß servidas fue tu única cerveza", "Maß del año pasado habría sido tu única cerveza", "Maß servidas fue una de tus 3 cervezas"],
  ] as const)("agrees the share caption with the beer count in %s", async (locale, current, lastYear, plural) => {
    const i18n = i18next.createInstance();
    await i18n.init({ resources: { [locale]: { translation: BUNDLES[locale] } }, lng: locale, interpolation: { escapeValue: false } });
    expect(i18n.t("wrapped.story.wiesnAndYou.share.current", { count: 1 })).toBe(current);
    expect(i18n.t("wrapped.story.wiesnAndYou.share.lastYear", { count: 1 })).toBe(lastYear);
    expect(i18n.t("wrapped.story.wiesnAndYou.share.current", { count: 3 })).toBe(plural);
  });

  // i18next splits a format on commas, so two number() options need a semicolon.
  it.each([
    ["en", "276.70 € well spent."],
    ["de", "276,70 € gut investiert."],
    ["es", "276,70 € bien invertidos."],
  ] as const)("formats the spend for %s readers", async (locale, expected) => {
    const i18n = i18next.createInstance();
    await i18n.init({ resources: { [locale]: { translation: BUNDLES[locale] } }, lng: locale, interpolation: { escapeValue: false } });
    expect(i18n.t("wrapped.story.drinks.spent", { amount: 276.7 })).toBe(expected);
  });

  // The Wiesn is Oktoberfest only; Frühlingsfest and Starkbierfest get neutral copy.
  it.each(["en", "de", "es"] as const)("never says Wiesn outside Oktoberfest in %s", async (locale) => {
    const i18n = i18next.createInstance();
    await i18n.init({ resources: { [locale]: { translation: BUNDLES[locale] } }, lng: locale, interpolation: { escapeValue: false } });
    const elsewhere = (mutate: (data: WrappedData) => void) =>
      makeWrapped((data) => {
        data.festivalInfo = { ...data.festivalInfo, name: "Starkbierfest 2026", festivalType: "starkbierfest" };
        mutate(data);
      });
    const stories = [
      elsewhere((data) => {
        data.basicStats.totalBeers = 0;
      }),
      elsewhere((data) => {
        data.comparisons.vsFestivalAvg.beersPercentile = 20;
        data.drinkStats.topDrinkType = "wine";
        data.basicStats.daysAttended = 12;
      }),
      elsewhere((data) => {
        data.basicStats.avgBeers = 8;
      }),
    ].map((data) => buildWrappedStory(data, null));
    const personas = stories.map((story) => story.find((slide) => slide.kind === "persona"));
    expect(personas.map((slide) => slide?.kind === "persona" && slide.personaId)).toEqual(
      expect.arrayContaining(["marathoner", "massMeister"]),
    );

    const translate = i18n.t as unknown as (key: string, options?: Record<string, unknown>) => string;
    const text = stories
      .flat()
      .map((slide) => slideSummaryText(slide, locale, (ref) => translate(ref.key, ref.params), String))
      .join("\n");
    expect(text).not.toMatch(/wiesn/i);

    const oktoberfest = buildWrappedStory(makeWrapped(), null).find((slide) => slide.kind === "persona");
    expect(oktoberfest && oktoberfest.kind === "persona" && translate(oktoberfest.kicker.key)).toMatch(/Wiesn/);
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
