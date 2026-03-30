"use client";

import { changeLanguage, i18n } from "@prostcounter/shared/i18n";
import { useEffect } from "react";

import { setLangCookie } from "@/lib/utils/langCookie";

/**
 * Syncs the i18n language with the URL locale on localized marketing pages.
 * Renders nothing — just ensures the correct language is active.
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
