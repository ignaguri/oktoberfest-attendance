"use client";

import { changeLanguage, i18n } from "@prostcounter/shared/i18n";
import { useEffect } from "react";

import { setLangCookie } from "@/lib/utils/langCookie";

/**
 * Carries the URL locale over to the global i18n state and the lang cookie, so
 * that landing on /de and then entering the app keeps you in German.
 *
 * It no longer affects what the marketing pages render: MarketingLocaleProvider
 * pins those to the URL locale during the server render, where this effect has
 * not run yet. Renders nothing.
 */
export function SyncLocale({ locale }: { locale: string }) {
  useEffect(() => {
    if (i18n.language !== locale) {
      changeLanguage(locale);
      setLangCookie(locale);
    }
  }, [locale]);

  return null;
}
