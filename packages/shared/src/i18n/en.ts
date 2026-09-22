import en from "./locales/en.json";

/**
 * Resolve a dotted i18n key against the English bundle.
 *
 * Push copy is rendered server-side by Novu, which has no access to the
 * recipient's locale, and every existing template is hardcoded English. The
 * achievements registry stores i18n keys rather than names
 * (sync-achievement-registry.ts writes nameKeyFor(slug)), so the API needs a
 * way to turn one into a string.
 *
 * @returns the string, or undefined when the key is absent or not a leaf.
 */
export function translateEn(key: string): string | undefined {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object" ? (node as Record<string, unknown>)[segment] : undefined,
      en as unknown,
    );

  return typeof value === "string" ? value : undefined;
}
