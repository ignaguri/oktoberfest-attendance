import type { SupportedLanguage } from "@prostcounter/shared/i18n";
import type { Metadata } from "next";

import { marketingUrlAbsolute } from "@/lib/utils/marketingUrl";

/**
 * Open Graph blocks for the marketing pages.
 *
 * Next merges metadata field by field, and `openGraph` is one field: a page
 * that defines it replaces the root layout's block wholesale rather than
 * merging into it, and a page that does not gets the root's English copy
 * verbatim. Nothing is derived from `title`/`description`, so a localized page
 * without its own block still shares an English card. Building the whole block
 * here is what keeps siteName, url and the image from being dropped one page at
 * a time.
 */

export const ogImages = [
  "/images/prost-counter-og-1.jpg",
  "/images/prost-counter-og-2.jpg",
  "/images/prost-counter-og-3.jpg",
  "/images/prost-counter-og-4.jpg",
  "/images/prost-counter-og-5.jpg",
  "/images/prost-counter-og-6.jpg",
  "/images/prost-counter-og-7.jpg",
];

export const randomOgImage = () => ogImages[Math.floor(Math.random() * ogImages.length)];

// og:locale wants the territory form, which is not what our language codes are.
const OG_LOCALES: Record<SupportedLanguage, string> = {
  en: "en_US",
  de: "de_DE",
  es: "es_ES",
};

type MarketingOpenGraphInput = {
  locale: SupportedLanguage;
  title: string;
  description: string;
  /** English form of the page path, e.g. "/", "/download", "/blog/tips". */
  path: string;
  /** Article pages render their own card image; everything else takes a house one. */
  images?: NonNullable<Metadata["openGraph"]>["images"];
};

export function marketingOpenGraph({
  locale,
  title,
  description,
  path,
  images,
}: MarketingOpenGraphInput) {
  return {
    title,
    description,
    url: marketingUrlAbsolute(path, locale),
    siteName: "ProstCounter",
    locale: OG_LOCALES[locale],
    images: images ?? [
      {
        url: randomOgImage(),
        width: 1200,
        height: 670,
        alt: "ProstCounter",
      },
    ],
  };
}
