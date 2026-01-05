import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

export const defaultNS = "translation";

export const resources = {
  en: {
    translation: en,
  },
} as const;

export type TranslationResources = (typeof resources)["en"]["translation"];

/**
 * Initialize i18n
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

/**
 * Supported languages
 * TODO: Add more languages when translations are available (de, es, fr)
 */
export const SUPPORTED_LANGUAGES = ["en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Re-export react-i18next hooks and components
export { useTranslation, Trans, I18nextProvider } from "react-i18next";
export { i18n };
