import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  GetCrowdStatusQuerySchema,
  GetCrowdStatusResponseSchema,
  GetTentCrowdReportsQuerySchema,
  GetTentCrowdReportsResponseSchema,
  SubmitCrowdReportBodySchema,
  SubmitCrowdReportResponseSchema,
} from "@prostcounter/shared";

import type { AuthContext } from "../middleware/auth";
import { ConflictError } from "../middleware/error";
import { SupabaseCrowdReportRepository } from "../repositories/supabase";

// Create router
const app = new OpenAPIHono<AuthContext>();

// GET /tents/crowd-status - Get current crowd status for all tents
const getCrowdStatusRoute = createRoute({
  method: "get",
  path: "/tents/crowd-status",
  tags: ["crowd-reports"],
  summary: "Get current crowd status for all tents",
  description:
    "Returns aggregated crowd status from the last 30 minutes for all tents in a festival",
  request: {
    query: GetCrowdStatusQuerySchema,
  },
  responses: {
    200: {
      description: "Crowd status retrieved successfully",
      content: {
        "application/json": {
          schema: GetCrowdStatusResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getCrowdStatusRoute, async (c) => {
  const supabase = c.var.supabase;
  const { festivalId } = c.req.valid("query");

  const repo = new SupabaseCrowdReportRepository(supabase);
  const data = await repo.getCrowdStatus(festivalId);

  return c.json({ data }, 200);
});

// GET /tents/:tentId/crowd-reports - Get recent reports for a specific tent
const getTentCrowdReportsRoute = createRoute({
  method: "get",
  path: "/tents/{tentId}/crowd-reports",
  tags: ["crowd-reports"],
  summary: "Get recent crowd reports for a tent",
  description:
    "Returns individual crowd reports from the last 30 minutes for a specific tent, ordered by most recent first",
  request: {
    params: z.object({
      tentId: z.string().uuid(),
    }),
    query: GetTentCrowdReportsQuerySchema,
  },
  responses: {
    200: {
      description: "Crowd reports retrieved successfully",
      content: {
        "application/json": {
          schema: GetTentCrowdReportsResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getTentCrowdReportsRoute, async (c) => {
  const supabase = c.var.supabase;
  const { tentId } = c.req.valid("param");
  const { festivalId } = c.req.valid("query");

  const repo = new SupabaseCrowdReportRepository(supabase);
  const data = await repo.getTentReports(tentId, festivalId);

  return c.json({ data }, 200);
});

// POST /tents/:tentId/crowd-report - Submit a crowd report
const submitCrowdReportRoute = createRoute({
  method: "post",
  path: "/tents/{tentId}/crowd-report",
  tags: ["crowd-reports"],
  summary: "Submit a crowd report for a tent",
  description:
    "Submit a crowd level and optional wait time report. Rate limited to 1 report per tent per user per 5 minutes.",
  request: {
    params: z.object({
      tentId: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: SubmitCrowdReportBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Crowd report submitted successfully",
      content: {
        "application/json": {
          schema: SubmitCrowdReportResponseSchema,
        },
      },
    },
    401: {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    409: {
      description: "Rate limited - recent report exists",
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(submitCrowdReportRoute, async (c) => {
  const supabase = c.var.supabase;
  const user = c.var.user;
  const { tentId } = c.req.valid("param");
  const body = c.req.valid("json");

  const repo = new SupabaseCrowdReportRepository(supabase);

  // Rate limit: max 1 report per tent per user per 5 minutes
  const hasRecent = await repo.hasRecentReport(tentId, user.id);
  if (hasRecent) {
    throw new ConflictError(
      "You already submitted a report for this tent within the last 5 minutes",
    );
  }

  const report = await repo.submitReport(tentId, user.id, body);

  return c.json({ report }, 201);
});

export default app;
