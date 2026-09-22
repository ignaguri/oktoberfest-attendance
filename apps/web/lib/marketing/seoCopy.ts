import type { SupportedLanguage } from "@prostcounter/shared/i18n";
import { resources } from "@prostcounter/shared/i18n/core";

type SeoPage = "home" | "download";

// generateMetadata runs on the server, where the react-i18next hooks are not
// available, so read the bundles straight from the server-safe core export.
export function seoCopy(locale: SupportedLanguage, page: SeoPage) {
  const bundle = resources[locale] ?? resources.en;
  return bundle.translation.marketing.seo[page];
}
