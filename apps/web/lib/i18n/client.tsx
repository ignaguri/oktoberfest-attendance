"use client";

import { useCurrentProfile } from "@/lib/data";
import { detectBrowserLanguage } from "@/lib/utils/detectLanguage";
import {
  initI18n,
  I18nextProvider,
  i18n,
  useTranslation as useTranslationBase,
  Trans as TransBase,
  SUPPORTED_LANGUAGES,
  changeLanguage,
} from "@prostcounter/shared/i18n";
import { useEffect, useState } from "react";

import type { TFunction } from "i18next";
import type { ReactNode } from "react";

// Initialize i18n on client with default language
initI18n();

/**
 * I18n Provider for the web app
 * Wrap your app with this in the root layout
 * Loads user's saved language preference and auto-detects if not set
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [isLanguageLoaded, setIsLanguageLoaded] = useState(false);
  const { data: profile } = useCurrentProfile();

  useEffect(() => {
    const loadLanguage = async () => {
      if (!profile) {
        // No profile yet, use default English
        setIsLanguageLoaded(true);
        return;
      }

      let languageToUse: string;

      if (profile.preferred_language) {
        // User has explicitly set a language
        languageToUse = profile.preferred_language;
      } else {
        // Auto-detect from browser
        languageToUse = detectBrowserLanguage([
          ...SUPPORTED_LANGUAGES,
        ] as string[]);

        // Note: We could save the detected language to the profile here,
        // but we'll let it happen naturally when the user first interacts
        // with the language selector or on first app use
      }

      // Change language if different from current
      if (i18n.language !== languageToUse) {
        await changeLanguage(languageToUse);
      }

      setIsLanguageLoaded(true);
    };

    loadLanguage();
  }, [profile]);

  // Don't render children until language is loaded to prevent flash of wrong language
  if (!isLanguageLoaded) {
    return null;
  }

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
export function translateError(
  t: TFunction,
  code: string,
  fallback?: string,
): string {
  return t(`apiErrors.${code}`, { defaultValue: fallback || code });
}
