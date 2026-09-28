import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import type { CopyRef } from "./types";

export function useStoryCopy(): (ref: CopyRef) => string {
  const { t } = useTranslation();
  // CopyRef keys are built dynamically, so they can't satisfy the typed key union.
  // wrapped-story-keys.test.ts checks every key the builder emits exists in en/de/es.
  const translate = t as unknown as (key: string, options?: Record<string, unknown>) => string;
  return useCallback((ref: CopyRef) => translate(ref.key, ref.params), [translate]);
}

export function useStoryLanguage(): "de" | "en" | "es" {
  const { i18n } = useTranslation();
  const language = i18n.language.slice(0, 2);
  return language === "de" || language === "es" ? language : "en";
}

export function useStoryNumber(): (value: number, maxFractionDigits?: number) => string {
  const { i18n } = useTranslation();
  return useCallback(
    (value: number, maxFractionDigits = 1) =>
      new Intl.NumberFormat(i18n.language, { maximumFractionDigits: maxFractionDigits }).format(value),
    [i18n.language],
  );
}
