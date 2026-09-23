import { describe, expect, it } from "vitest";

import { ANALYTICS_FEATURES, ANALYTICS_FUNNEL_STEPS } from "../../schemas/admin-analytics.schema";
import { ANALYTICS_RANGE_PRESETS } from "../../utils/analytics-metrics";
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

/** Every leaf key under `prefix` in the English bundle. */
function leafKeys(node: unknown, prefix: string): string[] {
  if (typeof node !== "object" || node === null) {
    return [prefix];
  }
  return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
    leafKeys(value, `${prefix}.${key}`),
  );
}

// Keys the UIs build dynamically must exist even if a refactor drops them from en.
const DYNAMIC_KEYS = [
  ...ANALYTICS_FEATURES.map((feature) => `admin.analytics.features.names.${feature}`),
  ...ANALYTICS_FUNNEL_STEPS.map((step) => `admin.analytics.funnel.steps.${step}`),
  ...ANALYTICS_RANGE_PRESETS.map((preset) => `admin.analytics.ranges.${preset}`),
];

const REQUIRED_KEYS = [
  "admin.tabs.analytics",
  "admin.mobile.sections.analytics",
  ...DYNAMIC_KEYS,
  ...leafKeys(lookup(en, "admin.analytics"), "admin.analytics"),
];

describe("admin analytics i18n keys", () => {
  it("defines the analytics namespace in English", () => {
    expect(typeof lookup(en, "admin.analytics")).toBe("object");
  });

  for (const [locale, bundle] of Object.entries(BUNDLES)) {
    for (const key of REQUIRED_KEYS) {
      it(`${locale} defines ${key}`, () => {
        const value = lookup(bundle, key);
        expect(typeof value).toBe("string");
        expect((value as string).length).toBeGreaterThan(0);
      });
    }
  }
});
