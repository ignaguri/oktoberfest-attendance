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

// =============================================================================
// Feature scorecard (piece 3)
// =============================================================================

/**
 * Features scored per festival: every v0 feature except attendance, which is
 * the base the others are measured against. Must match the VALUES list in
 * `analytics_feature_scorecard`; the integration test fails on drift.
 */
export const ANALYTICS_SCORECARD_FEATURES = [
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

export const AnalyticsScorecardFeatureSchema = z.enum(ANALYTICS_SCORECARD_FEATURES);
export type AnalyticsScorecardFeature = z.infer<typeof AnalyticsScorecardFeatureSchema>;

/** No festival means every festival, pooled. */
export const AnalyticsScorecardQuerySchema = z.object({
  festivalId: z.uuid().optional(),
});
export type AnalyticsScorecardQuery = z.infer<typeof AnalyticsScorecardQuerySchema>;

/** Raw counts; see utils/analytics-scorecard.ts for what they turn into. */
export const AnalyticsScorecardRowSchema = z.object({
  feature: AnalyticsScorecardFeatureSchema,
  attendees: z.number().int(),
  adopters: z.number().int(),
  cameBackUsers: z.number().int(),
  cameBackUsersBase: z.number().int(),
  cameBackNonUsers: z.number().int(),
  cameBackNonUsersBase: z.number().int(),
  returnedUsers: z.number().int(),
  returnedUsersBase: z.number().int(),
  returnedNonUsers: z.number().int(),
  returnedNonUsersBase: z.number().int(),
});
export type AnalyticsScorecardRow = z.infer<typeof AnalyticsScorecardRowSchema>;

export const AnalyticsScorecardResponseSchema = z.object({
  features: z.array(AnalyticsScorecardRowSchema),
});
export type AnalyticsScorecardResponse = z.infer<typeof AnalyticsScorecardResponseSchema>;

// =============================================================================
// Signup cohorts (piece 3)
// =============================================================================

export const AnalyticsCohortRowSchema = z.object({
  /** First day of the signup month (Europe/Berlin), YYYY-MM-DD. */
  month: IsoDateSchema,
  signups: z.number().int(),
  activated: z.number().int(),
  activated7d: z.number().int(),
  engaged: z.number().int(),
  returned: z.number().int(),
});
export type AnalyticsCohortRow = z.infer<typeof AnalyticsCohortRowSchema>;

export const AnalyticsCohortsResponseSchema = z.object({
  cohorts: z.array(AnalyticsCohortRowSchema),
});
export type AnalyticsCohortsResponse = z.infer<typeof AnalyticsCohortsResponseSchema>;

// =============================================================================
// Drill-down and timeline (piece 2)
// =============================================================================

/**
 * Who is behind a scorecard row. Each segment matches one scorecard column;
 * utils/analytics-drilldown.ts maps it to filters and to that column.
 */
export const ANALYTICS_SCORECARD_SEGMENTS = [
  "attendees",
  "adopters",
  "non_adopters",
  "came_back_adopters",
  "came_back_non_adopters",
  "returned_adopters",
  "returned_non_adopters",
] as const;
export const AnalyticsScorecardSegmentSchema = z.enum(ANALYTICS_SCORECARD_SEGMENTS);
export type AnalyticsScorecardSegment = z.infer<typeof AnalyticsScorecardSegmentSchema>;

/** Who is behind a cohort cell. `signups` is the whole month. */
export const ANALYTICS_COHORT_STEPS = [
  "signups",
  "activated",
  "activated_7d",
  "engaged",
  "returned",
] as const;
export const AnalyticsCohortStepSchema = z.enum(ANALYTICS_COHORT_STEPS);
export type AnalyticsCohortStep = z.infer<typeof AnalyticsCohortStepSchema>;

/** PostgREST's max_rows. A list this long may be missing people. */
export const ANALYTICS_MEMBERS_MAX_ROWS = 1000;

export const AnalyticsFunnelMembersQuerySchema = z
  .object({
    from: IsoDateSchema,
    to: IsoDateSchema,
    platform: AnalyticsPlatformSchema.optional(),
    step: AnalyticsFunnelStepNameSchema,
  })
  .superRefine((value, ctx) => {
    const message = analyticsRangeError(value.from, value.to);
    if (message) {
      ctx.addIssue({ code: "custom", message, path: ["from"] });
    }
  });
export type AnalyticsFunnelMembersQuery = z.infer<typeof AnalyticsFunnelMembersQuerySchema>;

/** No festival means every festival, pooled. */
export const AnalyticsScorecardMembersQuerySchema = z.object({
  festivalId: z.uuid().optional(),
  feature: AnalyticsScorecardFeatureSchema,
  segment: AnalyticsScorecardSegmentSchema,
});
export type AnalyticsScorecardMembersQuery = z.infer<typeof AnalyticsScorecardMembersQuerySchema>;

const MonthStartSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-01$/, "Expected the first day of a month, YYYY-MM-01");

export const AnalyticsCohortMembersQuerySchema = z.object({
  month: MonthStartSchema,
  step: AnalyticsCohortStepSchema,
});
export type AnalyticsCohortMembersQuery = z.infer<typeof AnalyticsCohortMembersQuerySchema>;

export const AnalyticsMemberSchema = z.object({
  userId: z.string(),
  username: z.string().nullable(),
  fullName: z.string().nullable(),
  signedUpAt: z.string().nullable(),
  lastActiveDay: IsoDateSchema.nullable(),
  /** Scorecard lists only: in the pooled view a person is listed once per festival. */
  festivalId: z.string().optional(),
  festivalName: z.string().optional(),
});
export type AnalyticsMember = z.infer<typeof AnalyticsMemberSchema>;

export const AnalyticsMembersResponseSchema = z.object({
  members: z.array(AnalyticsMemberSchema),
  /** True when the list reached ANALYTICS_MEMBERS_MAX_ROWS and may be incomplete. */
  truncated: z.boolean(),
});
export type AnalyticsMembersResponse = z.infer<typeof AnalyticsMembersResponseSchema>;

export const AnalyticsUserIdParamSchema = z.object({
  userId: z.uuid(),
});

export const ANALYTICS_TIMELINE_KINDS = ["all", "action", "event"] as const;
export const AnalyticsTimelineKindSchema = z.enum(ANALYTICS_TIMELINE_KINDS);
export type AnalyticsTimelineKind = z.infer<typeof AnalyticsTimelineKindSchema>;

/** Domain rows in the timeline. Must match the names in analytics_user_timeline. */
export const ANALYTICS_TIMELINE_ACTIONS = [
  "signed_up",
  "attendance",
  "drink",
  "photo",
  "group_join",
  "group_message",
  "photo_reaction",
  "photo_comment",
  "day_plan",
  "crowd_report",
  "friend_request",
  "location_sharing",
  "wrapped_view",
] as const;

export const ANALYTICS_TIMELINE_DEFAULT_LIMIT = 100;
export const ANALYTICS_TIMELINE_MAX_LIMIT = 200;

/**
 * The cursor is the last row's (occurredAt, cursorKey), passed back verbatim.
 * occurredAt keeps Postgres' microseconds; never round-trip it through Date.
 */
export const AnalyticsTimelineQuerySchema = z
  .object({
    cursorAt: z.iso.datetime({ offset: true }).optional(),
    cursorKey: z.string().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(ANALYTICS_TIMELINE_MAX_LIMIT).optional(),
    kind: AnalyticsTimelineKindSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.cursorAt === undefined) !== (value.cursorKey === undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "cursorAt and cursorKey go together",
        path: ["cursorAt"],
      });
    }
  });
export type AnalyticsTimelineQuery = z.infer<typeof AnalyticsTimelineQuerySchema>;

export const AnalyticsTimelineRowSchema = z.object({
  occurredAt: z.string(),
  kind: z.enum(["action", "event"]),
  name: z.string(),
  props: z.record(z.string(), z.unknown()),
  festivalId: z.string().nullable(),
  festivalName: z.string().nullable(),
  platform: z.string().nullable(),
  appVersion: z.string().nullable(),
  sessionId: z.string().nullable(),
  cursorKey: z.string(),
});
export type AnalyticsTimelineRow = z.infer<typeof AnalyticsTimelineRowSchema>;

export const AnalyticsTimelineCursorSchema = z.object({
  cursorAt: z.string(),
  cursorKey: z.string(),
});
export type AnalyticsTimelineCursor = z.infer<typeof AnalyticsTimelineCursorSchema>;

export const AnalyticsTimelineResponseSchema = z.object({
  rows: z.array(AnalyticsTimelineRowSchema),
  /** Null when this page is the last one. */
  nextCursor: AnalyticsTimelineCursorSchema.nullable(),
});
export type AnalyticsTimelineResponse = z.infer<typeof AnalyticsTimelineResponseSchema>;
