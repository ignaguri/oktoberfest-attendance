/**
 * Build a locale-aware marketing URL.
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
