import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  DeleteLiveActivityTokenSchema,
  LiveActivityTokenResponseSchema,
  RegisterLiveActivityTokenSchema,
} from "@prostcounter/shared";

import { ApiErrorSchema } from "../lib/error-response";
import type { AuthContext } from "../middleware/auth";
import { SupabaseLiveActivityTokenRepository } from "../repositories/supabase/live-activity-token.repository";

const app = new OpenAPIHono<AuthContext>();

const registerTokenRoute = createRoute({
  method: "post",
  path: "/live-activity/token",
  tags: ["live-activity"],
  summary: "Register a lock-screen counter push token",
  description:
    "Saves the push token of the caller's running Live Activity (iOS) or ongoing notification (Android) so the API can update it after writes",
  request: {
    body: { content: { "application/json": { schema: RegisterLiveActivityTokenSchema } } },
  },
  responses: {
    200: {
      description: "Token saved",
      content: { "application/json": { schema: LiveActivityTokenResponseSchema } },
    },
    400: {
      description: "Validation error",
      content: { "application/json": { schema: ApiErrorSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ApiErrorSchema } },
    },
  },
});

app.openapi(registerTokenRoute, async (c) => {
  const user = c.var.user;
  const body = c.req.valid("json");
  await new SupabaseLiveActivityTokenRepository(c.var.supabase).upsert(user.id, body);
  return c.json({ success: true }, 200);
});

const deleteTokenRoute = createRoute({
  method: "delete",
  path: "/live-activity/token",
  tags: ["live-activity"],
  summary: "Delete a lock-screen counter push token",
  description: "Removes the caller's token when their Live Activity or ongoing notification ends",
  request: {
    body: { content: { "application/json": { schema: DeleteLiveActivityTokenSchema } } },
  },
  responses: {
    200: {
      description: "Token deleted (or already gone)",
      content: { "application/json": { schema: LiveActivityTokenResponseSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ApiErrorSchema } },
    },
  },
});

app.openapi(deleteTokenRoute, async (c) => {
  const user = c.var.user;
  const body = c.req.valid("json");
  await new SupabaseLiveActivityTokenRepository(c.var.supabase).deleteToken(user.id, body.token);
  return c.json({ success: true }, 200);
});

export default app;
