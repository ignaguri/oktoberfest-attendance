"use client";

/**
 * i18n exports for client components
 *
 * For server components, import from '@prostcounter/shared/i18n/core' instead.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Re-export all constants from core (single source of truth)
export {
  defaultNS,
  LANGUAGE_NAMES,
  resources,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type TranslationResources,
} from "./core";
import { defaultNS, resources } from "./core";

/**
 * Initialize i18n with React bindings
 * Call this once at app startup (in layout or _app)
 */
export function initI18n(locale = "en") {
  if (!i18n.isInitialized) {
    i18n.use(initReactI18next).init({
      resources,
      lng: locale,
      fallbackLng: "en",
      defaultNS,
      ns: [defaultNS],
      interpolation: {
        escapeValue: false, // React already escapes
      },
      react: {
        useSuspense: false, // Disable for SSR compatibility
      },
    });
  }
  return i18n;
}

/**
 * Change the current language
 */
export function changeLanguage(locale: string) {
  return i18n.changeLanguage(locale);
}

/**
 * Get the current language code
 */
export function getCurrentLanguage(): string {
  return i18n.language || "en";
}

// Re-export react-i18next hooks and components (client-only)
export { I18nextProvider, Trans, useTranslation } from "react-i18next";
export { i18n };
