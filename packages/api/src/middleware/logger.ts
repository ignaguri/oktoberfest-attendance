/**
 * HTTP request/response logging middleware for Hono
 * Logs all incoming requests with method, path, status, duration, and user context
 */

import type { Context, Next } from "hono";

import { logger } from "../lib/logger";

export async function loggerMiddleware(c: Context, next: Next) {
  const start = Date.now();
  const { method, path } = c.req;

  // Log incoming request
  logger.debug({
    type: "request",
    method,
    path,
    headers: {
      "user-agent": c.req.header("user-agent"),
      "content-type": c.req.header("content-type"),
    },
  });

  // Process request
  await next();

  // Calculate duration
  const duration = Date.now() - start;
  const status = c.res.status;

  // Get user context if authenticated
  const userId = c.get("userId") as string | undefined;
  const userEmail = c.get("userEmail") as string | undefined;

  // Determine log level based on status code
  const logLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  // Log response
  logger[logLevel]({
    type: "response",
    method,
    path,
    status,
    duration,
    userId,
    userEmail,
  });
}
