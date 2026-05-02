"use client";

import {
  changeLanguage,
  i18n,
  I18nextProvider,
  initI18n,
  SUPPORTED_LANGUAGES,
  Trans as TransBase,
  useTranslation as useTranslationBase,
} from "@prostcounter/shared/i18n";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { useCurrentProfile } from "@/lib/data";
import { detectBrowserLanguage } from "@/lib/utils/detectLanguage";
import { getLangCookie, setLangCookie } from "@/lib/utils/langCookie";

/**
 * Detect the initial language synchronously from cookie or browser.
 * Called once at module load to initialize i18n with the correct language
 * before any React rendering, eliminating the blank flash for anonymous users.
 */
function detectInitialLanguage(): string {
  const supported = [...SUPPORTED_LANGUAGES] as string[];

  // 1. Check cookie (returning visitor)
  const cookieLang = getLangCookie();
  if (cookieLang && supported.includes(cookieLang)) {
    return cookieLang;
  }

  // 2. Detect from browser (first visit)
  const browserLang = detectBrowserLanguage(supported);

  // Persist for next visit
  setLangCookie(browserLang);

  return browserLang;
}

// Initialize i18n synchronously with the detected language
initI18n(detectInitialLanguage());

/**
 * I18n Provider for the web app.
 * For anonymous users, language is already set synchronously via cookie/browser detection.
 * For authenticated users, applies the saved preferred_language from their profile.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { data: profile } = useCurrentProfile();
  const hasAppliedProfile = useRef(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!profile || hasAppliedProfile.current) return;

    const applyProfileLanguage = async () => {
      let languageToUse: string;

      if (profile.preferred_language) {
        languageToUse = profile.preferred_language;
      } else {
        languageToUse = detectBrowserLanguage([...SUPPORTED_LANGUAGES] as string[]);
      }

      if (i18n.language !== languageToUse) {
        await changeLanguage(languageToUse);
        setLangCookie(languageToUse);
        forceUpdate((n) => n + 1);
      }

      hasAppliedProfile.current = true;
    };

    applyProfileLanguage();
  }, [profile]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

/**
 * useTranslation hook for client components
 *
 * Usage:
 * const { t } = useTranslation();
 * return <Button>{t('common.buttons.submit')}</Button>;
 */
export function useTranslation() {
  return useTranslationBase();
}

/**
 * Trans component for complex translations with embedded JSX
 */
export { TransBase as Trans };

/**
 * Get the current i18n instance
 */
export { i18n };

/**
 * Translate API error codes to localized messages
 */
export function translateError(t: TFunction, code: string, _fallback?: string): string {
  return t(`apiErrors.${code}`);
}
