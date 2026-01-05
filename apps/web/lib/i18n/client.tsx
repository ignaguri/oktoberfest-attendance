"use client";

import {
  initI18n,
  I18nextProvider,
  i18n,
  useTranslation as useTranslationBase,
  Trans as TransBase,
} from "@prostcounter/shared/i18n";

import type { TFunction } from "i18next";
import type { ReactNode } from "react";

// Initialize i18n on client
initI18n();

/**
 * I18n Provider for the web app
 * Wrap your app with this in the root layout
 */
export function I18nProvider({ children }: { children: ReactNode }) {
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
export const Trans = TransBase;

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
