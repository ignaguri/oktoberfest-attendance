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
