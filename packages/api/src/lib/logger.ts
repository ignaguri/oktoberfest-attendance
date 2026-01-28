/**
 * Centralized structured logging using Pino
 * Provides JSON logs in production and pretty-print in development
 */

import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const isDevelopment = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),

  // Pretty-print in development for readability
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      }
    : undefined,

  // Redact sensitive fields from logs
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
      "accessToken",
      "refreshToken",
      "apiKey",
      "secret",
    ],
    censor: "[REDACTED]",
  },

  // Add timestamp to all logs
  timestamp: pino.stdTimeFunctions.isoTime,

  // Base fields included in every log
  base: {
    env: process.env.NODE_ENV || "development",
  },

  // Serialize errors properly
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

/**
 * Create a child logger with additional context
 * Useful for adding request-specific or module-specific context
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
