import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { RecordEventsBodySchema, RecordEventsResponseSchema } from "@prostcounter/shared";

import { ApiErrorSchema } from "../lib/error-response";
import { logger } from "../lib/logger";
import type { AuthContext } from "../middleware/auth";
import { parseClientPlatformHeader, parseClientVersionHeader } from "../middleware/client-headers";
import { SupabaseEventsRepository } from "../repositories/supabase/events.repository";
import { prepareEvents } from "../services/event-ingest";
import { eventRateLimiter } from "../services/event-rate-limiter";

/**
 * Usage events from the apps (see packages/shared/src/analytics).
 *
 * Clients fire and forget: they never read this response body, and a failure
 * here must never surface to a user. Invalid or rate-limited events are
 * dropped and the route still answers 200 with how many were kept. A failed
 * insert answers 503, so the tracker gives the batch its one retry.
 */
const app = new OpenAPIHono<AuthContext>();

const recordEventsRoute = createRoute({
  method: "post",
  path: "/events",
  tags: ["events"],
  summary: "Record usage events",
  description:
    "Batch of 1-50 usage events for the signed-in user. Events with an unknown name, invalid or oversized props, or an unparseable timestamp are dropped individually; timestamps are clamped to the last 24 hours. Answers with the number recorded.",
  request: {
    body: {
      content: { "application/json": { schema: RecordEventsBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Events recorded (possibly fewer than sent)",
      content: { "application/json": { schema: RecordEventsResponseSchema } },
    },
    400: {
      description: "Malformed batch",
      content: { "application/json": { schema: ApiErrorSchema } },
    },
    401: {
      description: "Unauthorized",
      content: { "application/json": { schema: ApiErrorSchema } },
    },
    503: {
      description: "Events could not be written; the client may retry",
      content: { "application/json": { schema: ApiErrorSchema } },
    },
  },
  security: [{ bearerAuth: [] }],
});

app.openapi(recordEventsRoute, async (c) => {
  const { events } = c.req.valid("json");
  const user = c.get("user");

  const prepared = prepareEvents(events, new Date());
  const allowed = eventRateLimiter.take(user.id, prepared.length, Date.now());
  const toRecord = prepared.slice(0, allowed);

  if (toRecord.length === 0) {
    return c.json({ accepted: 0 }, 200);
  }

  try {
    const accepted = await new SupabaseEventsRepository().record(
      user.id,
      toRecord,
      parseClientPlatformHeader(c.req.header("X-Client-Platform")),
      parseClientVersionHeader(c.req.header("X-Client-Version")),
    );
    return c.json({ accepted }, 200);
  } catch (error) {
    // pino: mergingObject first, message second.
    logger.warn(
      {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to record usage events",
    );
    return c.json(
      {
        error: {
          message: "Failed to record events",
          code: "EVENTS_NOT_RECORDED",
          statusCode: 503,
        },
      },
      503,
    );
  }
});

export default app;
