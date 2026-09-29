import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { slideSummaryParts } from "./summary";
import type { CopyRef, StorySlide } from "./types";

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

/** The slide's whole text as one string, for its accessibility label / live region. */
export function useSlideSummary(slide: StorySlide): string {
  const copy = useStoryCopy();
  const formatNumber = useStoryNumber();
  const language = useStoryLanguage();
  return slideSummaryParts(slide, language)
    .map((part) => ("key" in part ? copy(part) : "number" in part ? formatNumber(part.number) : part.text))
    .filter((text) => text.length > 0)
    // Headings carry no full stop, so add one where a sentence would otherwise run on.
    .map((text) => (/[.!?:…]$/.test(text) ? text : `${text}.`))
    .join(" ");
}
