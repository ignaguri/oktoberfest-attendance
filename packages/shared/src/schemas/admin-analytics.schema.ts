import { z } from "zod";

/**
 * Admin analytics API schemas (dashboard v0)
 *
 * Shapes for the `/v1/admin/analytics/*` endpoints. v0 metrics read only domain
 * tables and `user_active_days`; event-backed metrics arrive in later phases.
 */

/**
 * Features ranked in the Features section, one per domain table that records a
 * user action. Must match the VALUES list in `analytics_feature_usage`; the
 * integration test in admin-analytics.integration.test.ts fails on drift.
 */
export const ANALYTICS_FEATURES = [
  "attendance",
  "drinks",
  "photos",
  "group_joins",
  "group_messages",
  "photo_reactions",
  "photo_comments",
  "day_plans",
  "crowd_reports",
  "friend_requests",
  "location_sharing",
  "wrapped",
] as const;

export const AnalyticsFeatureSchema = z.enum(ANALYTICS_FEATURES);
export type AnalyticsFeature = z.infer<typeof AnalyticsFeatureSchema>;

/** Longest span a metric query may cover, matching the spec's raw retention. */
export const ANALYTICS_MAX_RANGE_DAYS = 400;

const DAY_MS = 24 * 60 * 60 * 1000;

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/**
 * Why an inclusive [from, to] range is unacceptable, or null when it is fine.
 * Both bounds are YYYY-MM-DD and read as UTC days.
 */
export function analyticsRangeError(from: string, to: string): string | null {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return "Invalid date";
  }
  // Date.parse rolls calendar-invalid dates over (e.g. 2026-02-30 -> 2026-03-02)
  // instead of returning NaN, so round-trip through ISO and compare.
  if (
    new Date(fromMs).toISOString().slice(0, 10) !== from ||
    new Date(toMs).toISOString().slice(0, 10) !== to
  ) {
    return "Invalid date";
  }
  if (fromMs > toMs) {
    return "`from` must not be after `to`";
  }
  const days = Math.round((toMs - fromMs) / DAY_MS) + 1;
  if (days > ANALYTICS_MAX_RANGE_DAYS) {
    return `Range must not exceed ${ANALYTICS_MAX_RANGE_DAYS} days`;
  }
  return null;
}

export const ANALYTICS_PLATFORMS = ["ios", "android"] as const;
export const AnalyticsPlatformSchema = z.enum(ANALYTICS_PLATFORMS);
export type AnalyticsPlatform = z.infer<typeof AnalyticsPlatformSchema>;

/** Shared by overview, features and funnel. No platform means all platforms. */
export const AnalyticsRangeQuerySchema = z
  .object({
    from: IsoDateSchema,
    to: IsoDateSchema,
    platform: AnalyticsPlatformSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const message = analyticsRangeError(value.from, value.to);
    if (message) {
      ctx.addIssue({ code: "custom", message, path: ["from"] });
    }
  });
export type AnalyticsRangeQuery = z.infer<typeof AnalyticsRangeQuerySchema>;

// =============================================================================
// Overview
// =============================================================================

export const AnalyticsOverviewPointSchema = z.object({
  day: IsoDateSchema,
  dau: z.number().int(),
  wau: z.number().int(),
  mau: z.number().int(),
});
export type AnalyticsOverviewPoint = z.infer<typeof AnalyticsOverviewPointSchema>;

export const AnalyticsOverviewResponseSchema = z.object({
  series: z.array(AnalyticsOverviewPointSchema),
});
export type AnalyticsOverviewResponse = z.infer<typeof AnalyticsOverviewResponseSchema>;

// =============================================================================
// Feature usage
// =============================================================================

export const AnalyticsFeatureUsageRowSchema = z.object({
  feature: AnalyticsFeatureSchema,
  users: z.number().int(),
  events: z.number().int(),
});
export type AnalyticsFeatureUsageRow = z.infer<typeof AnalyticsFeatureUsageRowSchema>;

export const AnalyticsFeatureUsageResponseSchema = z.object({
  activeUsers: z.number().int(),
  features: z.array(AnalyticsFeatureUsageRowSchema),
});
export type AnalyticsFeatureUsageResponse = z.infer<typeof AnalyticsFeatureUsageResponseSchema>;

// =============================================================================
// Activation funnel
// =============================================================================

export const ANALYTICS_FUNNEL_STEPS = ["signed_up", "logged_attendance", "five_days"] as const;
export const AnalyticsFunnelStepNameSchema = z.enum(ANALYTICS_FUNNEL_STEPS);
export type AnalyticsFunnelStepName = z.infer<typeof AnalyticsFunnelStepNameSchema>;

export const AnalyticsFunnelStepSchema = z.object({
  step: AnalyticsFunnelStepNameSchema,
  users: z.number().int(),
});
export type AnalyticsFunnelStep = z.infer<typeof AnalyticsFunnelStepSchema>;

export const AnalyticsFunnelResponseSchema = z.object({
  steps: z.array(AnalyticsFunnelStepSchema),
});
export type AnalyticsFunnelResponse = z.infer<typeof AnalyticsFunnelResponseSchema>;

// =============================================================================
// Festival retention
// =============================================================================

export const AnalyticsFestivalRetentionRowSchema = z.object({
  festivalId: z.string(),
  festivalName: z.string(),
  startDate: IsoDateSchema,
  attendees: z.number().int(),
  /**
   * Null while the next festival has not started (or there is none). This
   * schema is the source of truth for the nullability: `packages/db/src/types.ts`
   * has a matching hand-edited `returned_next: number | null` for
   * `analytics_festival_retention` that a future `pnpm sup:db:types` run will
   * overwrite, so keep this field nullable here even if that regeneration
   * ever drops the `| null`.
   */
  returnedNext: z.number().int().nullable(),
  returnedAny: z.number().int(),
});
export type AnalyticsFestivalRetentionRow = z.infer<typeof AnalyticsFestivalRetentionRowSchema>;

export const AnalyticsFestivalRetentionResponseSchema = z.object({
  festivals: z.array(AnalyticsFestivalRetentionRowSchema),
});
export type AnalyticsFestivalRetentionResponse = z.infer<
  typeof AnalyticsFestivalRetentionResponseSchema
>;
