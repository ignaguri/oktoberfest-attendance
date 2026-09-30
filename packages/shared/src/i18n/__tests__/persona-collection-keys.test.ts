import { describe, expect, it } from "vitest";

import { PERSONA_IDS } from "../../wrapped/story/persona";
import de from "../locales/de.json";
import en from "../locales/en.json";
import es from "../locales/es.json";

const BUNDLES = { en, de, es } as const;

const REQUIRED_KEYS = [
  "wrapped.personas.title",
  "wrapped.personas.entry",
  "wrapped.personas.entryNoCount",
  "wrapped.personas.entryHint",
  "wrapped.personas.progress",
  "wrapped.personas.seeAll",
  "wrapped.personas.new",
  "wrapped.personas.tapToOpen",
  "wrapped.personas.tapToFlip",
  "wrapped.personas.howToEarn",
  "wrapped.personas.collectedAt",
  "wrapped.personas.number",
  "wrapped.personas.numberOfTotal",
  "wrapped.personas.lockedName",
  "wrapped.personas.previous",
  "wrapped.personas.next",
  "wrapped.personas.loadError",
  "wrapped.personas.a11y.locked",
  "wrapped.personas.a11y.unopened",
  "wrapped.personas.a11y.opened",
  "wrapped.personas.a11y.openHint",
  "wrapped.personas.a11y.flipHint",
  "wrapped.personas.a11y.thumbnailHint",
  ...PERSONA_IDS.map((id) => `wrapped.story.persona.${id}.hint`),
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

describe("Persona collection i18n keys", () => {
  for (const [locale, bundle] of Object.entries(BUNDLES)) {
    it(`${locale} has every key`, () => {
      const missing = REQUIRED_KEYS.filter((key) => typeof lookup(bundle, key) !== "string");
      expect(missing).toEqual([]);
    });
  }
});
