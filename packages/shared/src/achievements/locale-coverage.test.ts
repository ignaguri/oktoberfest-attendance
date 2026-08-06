import { describe, expect, it } from "vitest";

import de from "../i18n/locales/de.json";
import en from "../i18n/locales/en.json";
import es from "../i18n/locales/es.json";
import { ALL_DEFINITIONS } from "./definitions";
import { isSeries, slugFor } from "./types";
import type { AchievementCategory } from "./types";

type LocaleNode = string | { [key: string]: LocaleNode };

const LOCALES: Record<string, LocaleNode> = {
  en: en.achievements as unknown as LocaleNode,
  de: de.achievements as unknown as LocaleNode,
  es: es.achievements as unknown as LocaleNode,
};

const TIERS = ["bronze", "silver", "gold", "platinum"] as const;

const CATEGORIES: AchievementCategory[] = [
  "drinking",
  "attendance",
  "explorer",
  "social",
  "competitive",
  "dedication",
];

function resolve(node: LocaleNode | undefined, path: string[]): LocaleNode | undefined {
  let current: LocaleNode | undefined = node;
  for (const key of path) {
    if (current === undefined || typeof current === "string") return undefined;
    current = current[key];
  }
  return current;
}

function hasCopy(node: LocaleNode, slug: string): boolean {
  const entry = resolve(node, slug.split("."));
  if (entry === undefined || typeof entry === "string") return false;
  const name = entry.name;
  const description = entry.description;
  return (
    typeof name === "string" &&
    name.trim() !== "" &&
    typeof description === "string" &&
    description.trim() !== ""
  );
}

describe("achievement locale coverage", () => {
  describe("shared labels", () => {
    for (const [localeName, node] of Object.entries(LOCALES)) {
      it(`${localeName}: has all 4 tier labels`, () => {
        for (const tier of TIERS) {
          const label = resolve(node, ["tiers", tier]);
          expect(typeof label).toBe("string");
          expect((label as string) ?? "").not.toBe("");
        }
      });

      it(`${localeName}: has all 6 category labels in categories and filter`, () => {
        for (const category of CATEGORIES) {
          const categoryLabel = resolve(node, ["categories", category]);
          const filterLabel = resolve(node, ["filter", category]);
          expect(typeof categoryLabel).toBe("string");
          expect(typeof filterLabel).toBe("string");
        }
      });
    }
  });

  for (const category of CATEGORIES) {
    describe(`category: ${category}`, () => {
      const slugs = ALL_DEFINITIONS.filter((def) => def.category === category).flatMap((def) =>
        isSeries(def) ? def.tiers.map((tierDef) => slugFor(def, tierDef.tier)) : [slugFor(def)],
      );

      for (const [localeName, node] of Object.entries(LOCALES)) {
        it(`${localeName}: every ${category} slug has name and description`, () => {
          const missing = slugs.filter((slug) => !hasCopy(node, slug));
          expect(missing).toEqual([]);
        });
      }
    });
  }
});
