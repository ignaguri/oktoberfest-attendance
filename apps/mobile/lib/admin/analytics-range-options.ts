import type { Festival } from "@prostcounter/shared/schemas";
import { festivalRangeKey } from "@prostcounter/shared/utils";

/** One pickable time range: a preset ("30d") or a festival ("festival:<id>"). */
export interface AnalyticsRangeOption {
  key: string;
  label: string;
}

export interface AnalyticsRangeSection {
  id: "presets" | "festivals";
  options: AnalyticsRangeOption[];
}

/** Lowercased, trimmed, and without accents, so "fruh" matches "Frühlingsfest". */
function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * The analytics range picker's sections: presets first, then festivals newest
 * first, both filtered by a case- and accent-insensitive substring. Sections
 * with no match are dropped.
 */
export function analyticsRangeSections(
  presets: readonly AnalyticsRangeOption[],
  festivals: readonly Pick<Festival, "id" | "name" | "startDate">[],
  query: string,
): AnalyticsRangeSection[] {
  const needle = normalizeForSearch(query);
  const matches = (option: AnalyticsRangeOption) =>
    needle === "" || normalizeForSearch(option.label).includes(needle);

  const festivalOptions = [...festivals]
    .sort((left, right) => right.startDate.localeCompare(left.startDate))
    .map((festival) => ({ key: festivalRangeKey(festival.id), label: festival.name }));

  const sections: AnalyticsRangeSection[] = [
    { id: "presets", options: presets.filter(matches) },
    { id: "festivals", options: festivalOptions.filter(matches) },
  ];
  return sections.filter((section) => section.options.length > 0);
}
