import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  AnalyticsCohortsResponseSchema,
  AnalyticsFeatureUsageResponseSchema,
  AnalyticsFestivalRetentionResponseSchema,
  AnalyticsFunnelResponseSchema,
  AnalyticsOverviewResponseSchema,
  AnalyticsRangeQuerySchema,
  AnalyticsScorecardQuerySchema,
  AnalyticsScorecardResponseSchema,
} from "@prostcounter/shared";

import { ApiErrorSchema } from "../lib/error-response";
import type { AuthContext } from "../middleware/auth";
import { SupabaseAdminAnalyticsRepository } from "../repositories/supabase/admin-analytics.repository";

/**
 * Admin analytics routes (dashboard v0).
 *
 * Mounted under `/admin`, which `requireAdmin` guards as a prefix in index.ts.
 * Every metric is computed by an `analytics_*` SQL function; these handlers only
 * validate the range and map the rows.
 */
const app = new OpenAPIHono<AuthContext>();

const errorResponses = {
  400: {
    description: "Invalid range",
    content: { "application/json": { schema: ApiErrorSchema } },
  },
  401: {
    description: "Unauthorized",
    content: { "application/json": { schema: ApiErrorSchema } },
  },
  403: {
    description: "Forbidden - User is not an admin",
    content: { "application/json": { schema: ApiErrorSchema } },
  },
} as const;

// GET /admin/analytics/overview
const overviewRoute = createRoute({
  method: "get",
  path: "/admin/analytics/overview",
  tags: ["admin"],
  summary: "Active users per day (admin)",
  description: "Rolling DAU/WAU/MAU per day in the range, from user_active_days.",
  request: { query: AnalyticsRangeQuerySchema },
  responses: {
    200: {
      description: "Overview series",
      content: { "application/json": { schema: AnalyticsOverviewResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(overviewRoute, async (c) => {
  const { from, to, platform } = c.req.valid("query");
  const repository = new SupabaseAdminAnalyticsRepository();
  return c.json(await repository.getOverview(from, to, platform), 200);
});

// GET /admin/analytics/features
const featuresRoute = createRoute({
  method: "get",
  path: "/admin/analytics/features",
  tags: ["admin"],
  summary: "Feature usage (admin)",
  description:
    "Users and actions per feature in the range, from the domain tables. With platform, limited to users active on it in the range.",
  request: { query: AnalyticsRangeQuerySchema },
  responses: {
    200: {
      description: "Feature usage",
      content: { "application/json": { schema: AnalyticsFeatureUsageResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(featuresRoute, async (c) => {
  const { from, to, platform } = c.req.valid("query");
  const repository = new SupabaseAdminAnalyticsRepository();
  return c.json(await repository.getFeatureUsage(from, to, platform), 200);
});

// GET /admin/analytics/activation-funnel
const activationFunnelRoute = createRoute({
  method: "get",
  path: "/admin/analytics/activation-funnel",
  tags: ["admin"],
  summary: "Activation funnel (admin)",
  description:
    "Sign-ups in the range, and how many logged an attendance and 5+ days. With platform, limited to sign-ups ever active on it.",
  request: { query: AnalyticsRangeQuerySchema },
  responses: {
    200: {
      description: "Funnel steps",
      content: { "application/json": { schema: AnalyticsFunnelResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(activationFunnelRoute, async (c) => {
  const { from, to, platform } = c.req.valid("query");
  const repository = new SupabaseAdminAnalyticsRepository();
  return c.json(await repository.getActivationFunnel(from, to, platform), 200);
});

// GET /admin/analytics/festival-retention
const festivalRetentionRoute = createRoute({
  method: "get",
  path: "/admin/analytics/festival-retention",
  tags: ["admin"],
  summary: "Festival retention (admin)",
  description: "Per festival: attendees and how many came back, newest first.",
  responses: {
    200: {
      description: "Festival retention",
      content: { "application/json": { schema: AnalyticsFestivalRetentionResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(festivalRetentionRoute, async (c) => {
  const repository = new SupabaseAdminAnalyticsRepository();
  return c.json(await repository.getFestivalRetention(), 200);
});

// GET /admin/analytics/scorecard
const scorecardRoute = createRoute({
  method: "get",
  path: "/admin/analytics/scorecard",
  tags: ["admin"],
  summary: "Feature scorecard (admin)",
  description:
    "Per feature: attendees, adopters, and for users vs non-users how many came back during the festival and how many attended a later one. Without festivalId, every festival pooled.",
  request: { query: AnalyticsScorecardQuerySchema },
  responses: {
    200: {
      description: "Scorecard counts",
      content: { "application/json": { schema: AnalyticsScorecardResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(scorecardRoute, async (c) => {
  const { festivalId } = c.req.valid("query");
  const repository = new SupabaseAdminAnalyticsRepository();
  return c.json(await repository.getFeatureScorecard(festivalId), 200);
});

// GET /admin/analytics/cohorts
const cohortsRoute = createRoute({
  method: "get",
  path: "/admin/analytics/cohorts",
  tags: ["admin"],
  summary: "Signup cohorts (admin)",
  description:
    "Per signup month, newest first: sign-ups and how many activated, activated within 7 days, logged 3+ days at a festival, and attended 2+ festivals.",
  responses: {
    200: {
      description: "Signup cohorts",
      content: { "application/json": { schema: AnalyticsCohortsResponseSchema } },
    },
    ...errorResponses,
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(cohortsRoute, async (c) => {
  const repository = new SupabaseAdminAnalyticsRepository();
  return c.json(await repository.getSignupCohorts(), 200);
});

export default app;
