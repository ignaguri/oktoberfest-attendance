import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  AnalyticsFeatureUsageResponseSchema,
  AnalyticsFestivalRetentionResponseSchema,
  AnalyticsFunnelResponseSchema,
  AnalyticsOverviewQuerySchema,
  AnalyticsOverviewResponseSchema,
  AnalyticsRangeQuerySchema,
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
  request: { query: AnalyticsOverviewQuerySchema },
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
  description: "Users and actions per feature in the range, from the domain tables.",
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
  const { from, to } = c.req.valid("query");
  const repository = new SupabaseAdminAnalyticsRepository();
  return c.json(await repository.getFeatureUsage(from, to), 200);
});

// GET /admin/analytics/activation-funnel
const activationFunnelRoute = createRoute({
  method: "get",
  path: "/admin/analytics/activation-funnel",
  tags: ["admin"],
  summary: "Activation funnel (admin)",
  description: "Sign-ups in the range, and how many logged an attendance and 5+ days.",
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
  const { from, to } = c.req.valid("query");
  const repository = new SupabaseAdminAnalyticsRepository();
  return c.json(await repository.getActivationFunnel(from, to), 200);
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

export default app;
