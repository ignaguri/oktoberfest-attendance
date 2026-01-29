import { useCallback, useEffect, useState } from "react";

import {
  changeLanguage,
  getCurrentLanguage,
  LANGUAGE_NAMES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "../i18n";

/**
 * Storage interface that can be implemented by localStorage (web) or AsyncStorage (mobile)
 */
export interface LanguageStorage {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
}

const LANGUAGE_STORAGE_KEY = "prostcounter_language";

let storage: LanguageStorage | null = null;

/**
 * Set the storage implementation (must be called before using useLanguage)
 * @param storageImpl - localStorage (web) or AsyncStorage (mobile)
 */
export function setLanguageStorage(storageImpl: LanguageStorage) {
  storage = storageImpl;
}

/**
 * Hook for managing language selection
 * Works for both web and mobile apps
 */
export function useLanguage() {
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(
    () => (getCurrentLanguage() as SupportedLanguage) || "en",
  );
  const [isChanging, setIsChanging] = useState(false);

  // Load saved language preference on mount
  useEffect(() => {
    const loadSavedLanguage = async () => {
      if (!storage) {
        console.warn(
          "Language storage not configured. Call setLanguageStorage() first.",
        );
        return;
      }

      try {
        const savedLang = await storage.getItem(LANGUAGE_STORAGE_KEY);
        if (
          savedLang &&
          SUPPORTED_LANGUAGES.includes(savedLang as SupportedLanguage)
        ) {
          await changeLanguage(savedLang);
          setCurrentLanguage(savedLang as SupportedLanguage);
        }
      } catch (error) {
        console.error("Failed to load saved language:", error);
      }
    };

    loadSavedLanguage();
  }, []);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      console.error(`Unsupported language: ${lang}`);
      return;
    }

    setIsChanging(true);
    try {
      // Change i18n language
      await changeLanguage(lang);

      // Save to storage
      if (storage) {
        await storage.setItem(LANGUAGE_STORAGE_KEY, lang);
      }

      // Update state
      setCurrentLanguage(lang);
    } catch (error) {
      console.error("Failed to change language:", error);
    } finally {
      setIsChanging(false);
    }
  }, []);

  return {
    currentLanguage,
    currentLanguageName: LANGUAGE_NAMES[currentLanguage],
    setLanguage,
    isChanging,
  };
}
