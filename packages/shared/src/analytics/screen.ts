/**
 * Route → `screen` prop. Screens must never carry ids or usernames, so both
 * helpers return route templates ("/groups/[id]"), not concrete paths.
 */

/** Mirrors SUPPORTED_LANGUAGES in i18n/core (a test fails on drift). */
export const SCREEN_LOCALES = ["en", "de", "es"] as const;

const LOCALE_SET: ReadonlySet<string> = new Set(SCREEN_LOCALES);
const ROUTE_GROUP = /^\(.*\)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Web path segments whose next segment is a dynamic value. Mirrors the
 * [id] routes under apps/web/app/[lang]/(private): groups/[id],
 * group-settings/[id], user/[id]. user/[id] may be a username, which is why
 * this is by parent and not by "looks like an id".
 */
const WEB_DYNAMIC_PARENTS: ReadonlySet<string> = new Set(["groups", "group-settings", "user"]);

/** Mobile: expo-router segments are already templates ("[id]"); drop "(tabs)"-style groups. */
export function screenFromSegments(segments: readonly string[]): string {
  const path = segments.filter((segment) => !ROUTE_GROUP.test(segment)).join("/");
  return `/${path}`.toLowerCase();
}

/** Web: strip the locale, replace dynamic values with [id]. */
export function screenFromWebPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length > 0 && LOCALE_SET.has(parts[0])) {
    parts.shift();
  }
  const normalized = parts.map((part, index) => {
    const parent = index > 0 ? parts[index - 1] : undefined;
    if (UUID.test(part) || (parent !== undefined && WEB_DYNAMIC_PARENTS.has(parent))) {
      return "[id]";
    }
    return part.toLowerCase();
  });
  return `/${normalized.join("/")}`;
}
