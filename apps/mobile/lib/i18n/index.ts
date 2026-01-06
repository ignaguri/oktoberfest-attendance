import {
  initI18n,
  changeLanguage as sharedChangeLanguage,
  i18n,
} from "@prostcounter/shared/i18n";

const LANGUAGE_KEY = "@prostcounter/language";

/**
 * Initialize i18n for mobile
 * Detects device language and loads saved preference
 */
export async function initMobileI18n() {
  // Check if we're on the server (SSR)
  const isServer = typeof window === "undefined";

  if (isServer) {
    // On server, just initialize with English
    initI18n("en");
    return;
  }

  try {
    // Client-side: use AsyncStorage and expo-localization
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    const Localization = require("expo-localization");

    // Get saved language preference
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

    // Use saved language or device locale
    const locale = savedLanguage || Localization.locale?.split("-")[0] || "en";

    // Initialize with detected/saved language
    initI18n(locale);
  } catch (error) {
    // Fallback to English if anything fails
    console.warn("Failed to initialize i18n with locale detection:", error);
    initI18n("en");
  }
}

/**
 * Change language and persist to storage
 */
export async function setLanguage(language: string) {
  const isServer = typeof window === "undefined";

  if (!isServer) {
    try {
      const AsyncStorage =
        require("@react-native-async-storage/async-storage").default;
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
      console.warn("Failed to persist language:", error);
    }
  }

  await sharedChangeLanguage(language);
}

// Re-export from shared
export { i18n, sharedChangeLanguage as changeLanguage };
export {
  useTranslation,
  Trans,
  I18nextProvider,
} from "@prostcounter/shared/i18n";
