import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  DismissDayFeedbackPromptBodySchema,
  DismissDayFeedbackPromptResponseSchema,
  GetDayFeedbackPromptResponseSchema,
  ListAdminFeedbackQuerySchema,
  ListAdminFeedbackResponseSchema,
  SubmitFeedbackBodySchema,
  SubmitFeedbackResponseSchema,
} from "@prostcounter/shared";

import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiErrorSchema } from "../lib/error-response";
import { createResendFeedbackNotifier } from "../lib/feedback-email";
import type { AuthContext } from "../middleware/auth";
import { SupabaseFeedbackRepository } from "../repositories/supabase";
import { FeedbackService } from "../services/feedback.service";

const app = new OpenAPIHono<AuthContext>();

function createService(supabase: SupabaseClient): FeedbackService {
  return new FeedbackService(
    new SupabaseFeedbackRepository(supabase),
    createResendFeedbackNotifier({
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      FEEDBACK_NOTIFY_EMAIL: process.env.FEEDBACK_NOTIFY_EMAIL,
    }),
  );
}

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ApiErrorSchema } },
});

// GET /feedback/prompt - Whether to ask about yesterday right now
const getDayPromptRoute = createRoute({
  method: "get",
  path: "/feedback/prompt",
  tags: ["feedback"],
  summary: "Get the day feedback prompt, if one is due",
  responses: {
    200: {
      description: "The day to ask about, or null",
      content: { "application/json": { schema: GetDayFeedbackPromptResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(getDayPromptRoute, async (c) => {
  const prompt = await createService(c.var.supabase).getDayPrompt(c.var.user.id);
  return c.json({ prompt }, 200);
});

// POST /feedback - Submit a day rating, bug report or idea
const submitFeedbackRoute = createRoute({
  method: "post",
  path: "/feedback",
  tags: ["feedback"],
  summary: "Submit feedback",
  description: "Bug reports and ideas are limited to 10 per user per rolling 24 hours.",
  request: {
    body: { content: { "application/json": { schema: SubmitFeedbackBodySchema } } },
  },
  responses: {
    201: {
      description: "Feedback stored",
      content: { "application/json": { schema: SubmitFeedbackResponseSchema } },
    },
    400: errorResponse("Invalid body, or no drinks logged on that day"),
    401: errorResponse("Unauthorized"),
    429: errorResponse("Too many bug reports and ideas today"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(submitFeedbackRoute, async (c) => {
  const user = c.var.user;
  const result = await createService(c.var.supabase).submit(
    {
      userId: user.id,
      userEmail: user.email ?? null,
      platform: c.req.header("X-Client-Platform") ?? null,
      appVersion: c.req.header("X-Client-Version") ?? null,
    },
    c.req.valid("json"),
  );
  return c.json(result, 201);
});

// POST /feedback/prompt/dismiss - The user closed the day prompt
const dismissDayPromptRoute = createRoute({
  method: "post",
  path: "/feedback/prompt/dismiss",
  tags: ["feedback"],
  summary: "Dismiss the day feedback prompt",
  request: {
    body: { content: { "application/json": { schema: DismissDayFeedbackPromptBodySchema } } },
  },
  responses: {
    200: {
      description: "Dismissal recorded",
      content: { "application/json": { schema: DismissDayFeedbackPromptResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(dismissDayPromptRoute, async (c) => {
  const { festivalId, day } = c.req.valid("json");
  await createService(c.var.supabase).dismissDayPrompt(c.var.user.id, festivalId, day);
  return c.json({ success: true as const }, 200);
});

// GET /admin/feedback - Newest feedback first (requireAdmin guards /admin/*)
const listAdminFeedbackRoute = createRoute({
  method: "get",
  path: "/admin/feedback",
  tags: ["admin"],
  summary: "List feedback for admins",
  request: { query: ListAdminFeedbackQuerySchema },
  responses: {
    200: {
      description: "Feedback, newest first",
      content: { "application/json": { schema: ListAdminFeedbackResponseSchema } },
    },
    401: errorResponse("Unauthorized"),
    403: errorResponse("Admin access required"),
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(listAdminFeedbackRoute, async (c) => {
  const query = c.req.valid("query");
  const items = await createService(c.var.supabase).listForAdmin(query);
  return c.json({ items }, 200);
});

export default app;
