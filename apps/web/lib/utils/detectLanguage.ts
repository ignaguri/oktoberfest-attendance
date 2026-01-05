/**
 * Detect user's preferred language from browser
 * Falls back to 'en' if detection fails or language not supported
 */
export function detectBrowserLanguage(supportedLanguages: string[]): string {
  if (typeof window === "undefined") return "en";

  // Try navigator.language first (e.g., "en-US")
  const browserLang = navigator.language || navigator.languages?.[0];

  if (browserLang) {
    // Extract base language code (e.g., "en" from "en-US")
    const baseCode = browserLang.split("-")[0].toLowerCase();

    if (supportedLanguages.includes(baseCode)) {
      return baseCode;
    }
  }

  // Fallback to English
  return "en";
}

/**
 * Get the display name for a language code
 */
export function getLanguageDisplayName(code: string): string {
  const languageNames: Record<string, string> = {
    en: "English",
    de: "Deutsch",
    es: "Español",
    fr: "Français",
  };

  return languageNames[code] || code;
}
