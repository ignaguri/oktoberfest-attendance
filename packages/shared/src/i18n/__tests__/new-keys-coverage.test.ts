import { describe, expect, it } from "vitest";

import de from "../locales/de.json";
import en from "../locales/en.json";
import es from "../locales/es.json";

const BUNDLES = { en, de, es } as const;

/**
 * Keys added by the feed-tents and notification-repair work. Scoped to the new
 * keys on purpose: a full parity assertion across every key would fail on
 * pre-existing drift unrelated to this change.
 */
const REQUIRED_KEYS = [
  "activityFeed.atTent",
  // Web settings screen
  "notificationSettings.dayStart",
  "notificationSettings.description.dayStart",
  // Mobile settings screen — a different namespace, not a duplicate
  "profile.notifications.dayStart",
  "profile.notifications.dayStartDescription",
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

describe("new i18n keys", () => {
  for (const [locale, bundle] of Object.entries(BUNDLES)) {
    for (const key of REQUIRED_KEYS) {
      it(`${locale} defines ${key}`, () => {
        expect(typeof lookup(bundle, key)).toBe("string");
      });
    }
  }
});
