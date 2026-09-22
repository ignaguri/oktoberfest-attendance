"use client";

import { i18n, I18nextProvider, initI18n } from "@prostcounter/shared/i18n";
import type { SupportedLanguage } from "@prostcounter/shared/i18n";
import { createContext, useContext, type ReactNode } from "react";

// The root layout initializes this too, but module evaluation order is not
// guaranteed to put it first, and cloneInstance needs an initialized source.
initI18n();

// One instance per locale, created lazily and reused. Cloning per render would
// rebuild the resource store on every request; sharing the global singleton
// instead would mean a language set for one request leaks into another, since
// static prerendering renders every locale in the same process.
const instances = new Map<SupportedLanguage, typeof i18n>();

function instanceFor(locale: SupportedLanguage) {
  const existing = instances.get(locale);
  if (existing) {
    return existing;
  }

  const created = i18n.cloneInstance({ lng: locale });
  instances.set(locale, created);
  return created;
}

const MarketingLocaleContext = createContext<SupportedLanguage>("en");

/**
 * Pins the marketing subtree to the locale in the URL.
 *
 * Without this the pages render through the global i18n singleton, which on the
 * server has no cookie to read and so always falls back to English: /de and /es
 * were served as English HTML and only swapped to the right language after
 * hydration, which is what search engines and no-JS clients saw.
 *
 * The locale comes from the `[lang]` route param rather than the pathname,
 * because proxy.ts rewrites public URLs onto that segment and a rewritten path
 * does not match the browser's during hydration.
 */
export function MarketingLocaleProvider({
  locale,
  children,
}: {
  locale: SupportedLanguage;
  children: ReactNode;
}) {
  return (
    <MarketingLocaleContext.Provider value={locale}>
      <I18nextProvider i18n={instanceFor(locale)}>{children}</I18nextProvider>
    </MarketingLocaleContext.Provider>
  );
}

/**
 * The locale of the marketing page being rendered. Use this instead of reading
 * `i18n.language`, which is process-global and wrong on the server.
 */
export function useMarketingLocale() {
  return useContext(MarketingLocaleContext);
}
