import { PROD_URL } from "@prostcounter/shared/constants";
import type { SupportedLanguage } from "@prostcounter/shared/i18n";
import { SUPPORTED_LANGUAGES } from "@prostcounter/shared/i18n/core";

/**
 * Public marketing URLs and the internal routes behind them.
 *
 * Every route lives under `app/[lang]/` so that the root layout can put the
 * right language on `<html>`, but the URLs users and search engines see are
 * unchanged: proxy.ts rewrites between the two. That makes this file the one
 * place that knows both shapes, so nothing else has to think about it.
 *
 *   public            internal
 *   /                 /en
 *   /de               /de
 *   /download         /en/download
 *   /de/download      /de/download
 *   /blog             /en/blog
 *   /blog/de          /de/blog
 *   /blog/de/tips     /de/blog/tips
 */

/**
 * Build a locale-aware public marketing URL.
 * English uses the base path, other locales get a prefix.
 */
export function marketingUrl(path: string, locale: string): string {
  if (locale === "en") return path;

  // Blog paths: /blog/slug → /blog/de/slug
  if (path.startsWith("/blog")) {
    const rest = path.slice("/blog".length);
    return `/blog/${locale}${rest}`;
  }

  // Other marketing paths: /download → /de/download, / → /de
  if (path === "/") return `/${locale}`;
  return `/${locale}${path}`;
}

/** Absolute form of `marketingUrl`, for canonical tags and sitemap entries. */
export function marketingUrlAbsolute(path: string, locale: string): string {
  const url = marketingUrl(path, locale);
  return url === "/" ? PROD_URL : `${PROD_URL}${url}`;
}

/**
 * The hreflang map for one page, keyed by language.
 * `path` is the English form, e.g. "/", "/download", "/blog/oktoberfest-guide".
 */
export function localeAlternates(
  path: string,
  locales: readonly SupportedLanguage[] = SUPPORTED_LANGUAGES,
): Record<string, string> {
  return Object.fromEntries(locales.map((locale) => [locale, marketingUrlAbsolute(path, locale)]));
}

function isSupportedLanguage(segment: string | undefined): segment is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(segment as SupportedLanguage);
}

/**
 * Narrow the `[lang]` route param.
 *
 * Next types route params as plain strings, and an unknown value cannot reach
 * these pages anyway (the rewrites only ever produce a supported locale, and
 * anything else resolves to no route at all), so falling back to English is
 * enough and keeps every page from having to cast.
 */
export function toSupportedLanguage(value: string): SupportedLanguage {
  return isSupportedLanguage(value) ? value : "en";
}

/**
 * Strip the internal `[lang]` segment off a pathname.
 *
 * Client components read the browser URL through `usePathname`, but while they
 * are rendered on the server they see the rewritten path instead. Anything that
 * matches on the pathname during render has to compare the same shape on both
 * sides or React reports a hydration mismatch, so route away from the prefix.
 */
export function publicPathname(pathname: string | null): string {
  if (!pathname) return "/";

  const segments = pathname.split("/").filter(Boolean);
  if (!isSupportedLanguage(segments[0])) {
    return pathname;
  }

  const rest = segments.slice(1);
  return rest.length ? `/${rest.join("/")}` : "/";
}
