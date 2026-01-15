/**
 * Core i18n functions - server-safe (no React dependencies)
 *
 * Use this for server components/actions. For client components,
 * import from '@prostcounter/shared/i18n' instead.
 */

import i18n from "i18next";

import en from "./locales/en.json";

export const defaultNS = "translation";

export const resources = {
  en: {
    translation: en,
  },
} as const;

export type TranslationResources = (typeof resources)["en"]["translation"];

/**
 * Initialize i18n for server-side usage (without React bindings)
 * Call this once at server startup
 */
export function initI18n(locale = "en") {
  if (!i18n.isInitialized) {
    i18n.init({
      resources,
      lng: locale,
      fallbackLng: "en",
      defaultNS,
      ns: [defaultNS],
      interpolation: {
        escapeValue: false,
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

export { i18n };
