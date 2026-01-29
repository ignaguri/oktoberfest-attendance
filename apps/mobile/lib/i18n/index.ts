import { setLanguageStorage } from "@prostcounter/shared/hooks";
import {
  changeLanguage as sharedChangeLanguage,
  i18n,
  initI18n,
} from "@prostcounter/shared/i18n";

import { logger } from "../logger";

const LANGUAGE_KEY = "@prostcounter/language";

// Configure language storage for mobile (AsyncStorage)
if (typeof window !== "undefined") {
  import("@react-native-async-storage/async-storage").then((module) => {
    setLanguageStorage({
      getItem: (key: string) => module.default.getItem(key),
      setItem: (key: string, value: string) =>
        module.default.setItem(key, value),
    });
  });
}

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
    logger.warn("Failed to initialize i18n with locale detection", { error });
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
      logger.warn("Failed to persist language", { error });
    }
  }

  await sharedChangeLanguage(language);
}

// Re-export from shared
export { sharedChangeLanguage as changeLanguage, i18n };
export {
  I18nextProvider,
  Trans,
  useTranslation,
} from "@prostcounter/shared/i18n";
