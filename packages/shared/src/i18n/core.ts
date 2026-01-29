/**
 * Core i18n functions - server-safe (no React dependencies)
 *
 * Use this for server components/actions. For client components,
 * import from '@prostcounter/shared/i18n' instead.
 */

import i18n from "i18next";

import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";

export const defaultNS = "translation";

export const resources = {
  en: {
    translation: en,
  },
  de: {
    translation: de,
  },
  es: {
    translation: es,
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
 * TODO: Add more languages when translations are available (fr, pt, it)
 */
export const SUPPORTED_LANGUAGES = ["en", "de", "es"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: "English",
  de: "Deutsch",
  es: "Español",
};

export { i18n };
