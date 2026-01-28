/**
 * Centralized logging utility for the mobile app
 * Logs to console in development and can be extended to send to monitoring services
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

// Sensitive header names to redact (case-insensitive)
const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "x-api-key",
  "x-auth-token",
  "x-access-token",
  "x-refresh-token",
];

// Max size for logged data (in characters when serialized)
const MAX_LOG_DATA_SIZE = 2000;

/**
 * Safely stringify data, handling circular references and large objects
 */
function safeStringify(data: unknown, indent = 2): string {
  const seen = new WeakSet();

  try {
    const result = JSON.stringify(
      data,
      (key, value) => {
        // Handle circular references
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);
        }
        return value;
      },
      indent,
    );

    // Truncate if too large
    if (result && result.length > MAX_LOG_DATA_SIZE) {
      return result.substring(0, MAX_LOG_DATA_SIZE) + "... [truncated]";
    }

    return result;
  } catch {
    return "[Unable to serialize]";
  }
}

/**
 * Truncate data for logging - handles strings, objects, and arrays
 */
function truncateData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    return data.length > 500
      ? `${data.substring(0, 500)}... [truncated]`
      : data;
  }

  // For objects/arrays, let safeStringify handle truncation
  return data;
}

class Logger {
  private isDev =
    typeof __DEV__ !== "undefined"
      ? __DEV__
      : process.env.NODE_ENV !== "production";

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `\n${safeStringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext) {
    if (this.isDev) {
      console.log(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: LogContext) {
    console.info(this.formatMessage("info", message, context));
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatMessage("warn", message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorContext = {
      ...context,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    };

    console.error(this.formatMessage("error", message, errorContext));

    // Send to Sentry in production
    if (!this.isDev) {
      try {
        // Dynamic import to avoid issues if Sentry isn't loaded
        const Sentry = require("./sentry").Sentry;

        // Check if Sentry is initialized (has a client)
        const client = Sentry.getClient?.();
        if (!client) {
          // Sentry not initialized yet, skip sending
          return;
        }

        if (error instanceof Error) {
          Sentry.captureException(error, {
            contexts: {
              custom: context,
            },
            tags: {
              source: "logger",
            },
          });
        } else {
          Sentry.captureMessage(message, {
            level: "error",
            contexts: {
              custom: errorContext,
            },
          });
        }
      } catch {
        // Fail silently if Sentry isn't available or not initialized
      }
    }
  }

  logApiRequest(method: string, url: string, headers?: Record<string, string>) {
    this.debug(`API Request: ${method} ${url}`, {
      method,
      url,
      headers: this.sanitizeHeaders(headers),
    });
  }

  logApiResponse(method: string, url: string, status: number, data?: unknown) {
    this.debug(`API Response: ${method} ${url} - ${status}`, {
      method,
      url,
      status,
      data: truncateData(data),
    });
  }

  logApiError(method: string, url: string, error: unknown) {
    this.error(`API Error: ${method} ${url}`, error, {
      method,
      url,
    });
  }

  private sanitizeHeaders(
    headers?: Record<string, string>,
  ): Record<string, string> {
    if (!headers) return {};

    const sanitized: Record<string, string> = {};

    // Mask sensitive headers (case-insensitive check)
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_HEADERS.includes(lowerKey)) {
        // Show first 10 chars to help with debugging, then mask
        sanitized[key] =
          value.length > 10 ? `${value.substring(0, 10)}...` : "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

export const logger = new Logger();
