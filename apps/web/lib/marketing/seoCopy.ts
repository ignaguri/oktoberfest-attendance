import type { SupportedLanguage } from "@prostcounter/shared/i18n";
import { resources } from "@prostcounter/shared/i18n/core";

import { localizeCategory, localizeCategoryDescription } from "@/components/blog/blog-i18n";
import type { BlogCategory } from "@/lib/blog";

type SeoPage = "home" | "download" | "blogIndex";

// generateMetadata runs on the server, where the react-i18next hooks are not
// available, so read the bundles straight from the server-safe core export.
export function seoCopy(locale: SupportedLanguage, page: SeoPage) {
  const bundle = resources[locale] ?? resources.en;
  return bundle.translation.marketing.seo[page];
}

export function blogIndexCopy(locale: SupportedLanguage) {
  return seoCopy(locale, "blogIndex");
}

/**
 * Category pages have no hand-written SEO copy, so build it from the labels the
 * page itself renders. That keeps the title, the heading and the meta
 * description saying the same thing in every language.
 */
export function categoryCopy(locale: SupportedLanguage, category: BlogCategory) {
  return {
    title: `${localizeCategory(category, locale)} - ProstCounter Blog`,
    description: localizeCategoryDescription(category, locale),
  };
}
