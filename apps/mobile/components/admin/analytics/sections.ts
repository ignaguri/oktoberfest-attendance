/** Analytics sections, in display order. Also the `[section]` route values. */
export const ANALYTICS_SECTIONS = ["overview", "features", "funnel", "retention"] as const;

export type AnalyticsSection = (typeof ANALYTICS_SECTIONS)[number];

export function parseAnalyticsSection(value: string | undefined): AnalyticsSection | null {
  return ANALYTICS_SECTIONS.find((section) => section === value) ?? null;
}
