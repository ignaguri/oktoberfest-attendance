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
