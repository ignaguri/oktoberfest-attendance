import { describe, expect, it } from "vitest";

import de from "../locales/de.json";
import en from "../locales/en.json";
import es from "../locales/es.json";

const BUNDLES = { en, de, es } as const;

const REQUIRED_KEYS = [
  "wrapped.cta.countdown_one",
  "wrapped.cta.countdown_other",
  "wrapped.cta.teaser",
  "wrapped.cta.teaserEmpty",
  "wrapped.cta.days_one",
  "wrapped.cta.days_other",
  "profile.wrappedArchive.row_one",
  "profile.wrappedArchive.row_other",
  "profile.wrappedArchive.newCount_one",
  "profile.wrappedArchive.newCount_other",
  "profile.wrappedArchive.listHint",
];

function lookup(bundle: object, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined,
      bundle,
    );
}

describe("Wrapped retention i18n keys", () => {
  for (const [locale, bundle] of Object.entries(BUNDLES)) {
    it(`${locale} has every key`, () => {
      const missing = REQUIRED_KEYS.filter((key) => typeof lookup(bundle, key) !== "string");
      expect(missing).toEqual([]);
    });
  }
});

const REMOVED_KEYS = [
  "wrapped.cta.preparing",
  "wrapped.cta.preparingDescription",
  "wrapped.cta.preparingFooter",
];

describe("retired Wrapped CTA keys", () => {
  for (const [locale, bundle] of Object.entries(BUNDLES)) {
    it(`${locale} no longer has the last-day preparing copy`, () => {
      expect(REMOVED_KEYS.filter((key) => lookup(bundle, key) !== undefined)).toEqual([]);
    });
  }
});
