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
    return data.length > 500 ? `${data.substring(0, 500)}... [truncated]` : data;
  }

  // For objects/arrays, let safeStringify handle truncation
  return data;
}

/**
 * Stringify nested object values so Sentry's shallow serializer
 * doesn't reduce them to "[Object]"
 */
function stringifyContextValues(ctx?: LogContext): LogContext | undefined {
  if (!ctx) return undefined;
  return Object.fromEntries(
    Object.entries(ctx).map(([k, v]) => [
      k,
      typeof v === "object" && v !== null
        ? v instanceof Error
          ? safeStringify({ name: v.name, message: v.message, stack: v.stack })
          : safeStringify(v)
        : v,
    ]),
  );
}

/**
 * An error raised before Sentry.init has run used to be dropped outright, and
 * that is exactly the window cold-start failures live in: a device that could
 * not save a drink for two hours reported nothing for the first of them. Hold
 * those events here and send them once a client exists.
 */
interface PendingSentryEvent {
  message: string;
  error?: Error | unknown;
  context?: LogContext;
  errorContext: LogContext;
  /**
   * When the error actually happened. Sentry stamps a held event at flush time,
   * which on these cold starts can be half a minute late, so the real time
   * rides along in the context.
   */
  loggedAt: string;
}

/** Bound keeps a boot loop from growing the queue without limit. */
const MAX_PENDING_SENTRY_EVENTS = 50;

const pendingSentryEvents: PendingSentryEvent[] = [];

type SentryLike = {
  getClient?: () => unknown;
  captureException: (error: unknown, hint?: unknown) => void;
  captureMessage: (message: string, hint?: unknown) => void;
};

function loadSentry(): SentryLike | null {
  try {
    // The SDK directly, not ./sentry. That wrapper imports this module for
    // flushPendingSentryEvents, and requiring it back would close a cycle in
    // the one path that has to work during a cold start. It only re-exports
    // this same namespace, and capture reaches the client through the SDK's
    // own global registry, so nothing is lost by skipping it - beforeSend and
    // the rest of the init config still apply.
    //
    // Loaded lazily so this module stays usable if Sentry isn't bundled.
    return require("@sentry/react-native") as SentryLike;
  } catch {
    return null;
  }
}

function captureWithSentry(sentry: SentryLike, event: PendingSentryEvent) {
  if (event.error instanceof Error) {
    sentry.captureException(event.error, {
      contexts: {
        custom: { ...stringifyContextValues(event.context), loggedAt: event.loggedAt },
      },
      tags: {
        source: "logger",
      },
    });
  } else {
    sentry.captureMessage(event.message, {
      level: "error",
      contexts: {
        custom: { ...stringifyContextValues(event.errorContext), loggedAt: event.loggedAt },
      },
    });
  }
}

/**
 * Send everything logged before Sentry came up. Safe to call repeatedly;
 * initSentry calls it as soon as a client exists.
 */
export function flushPendingSentryEvents() {
  if (pendingSentryEvents.length === 0) return;

  const sentry = loadSentry();
  if (!sentry?.getClient?.()) return;

  const queued = pendingSentryEvents.splice(0, pendingSentryEvents.length);
  for (const event of queued) {
    try {
      captureWithSentry(sentry, event);
    } catch {
      // One rejected event must not stop the rest of the queue draining.
    }
  }
}

class Logger {
  private isDev = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `\n${safeStringify(context)}` : "";
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext) {
    if (this.isDev) {
      // eslint-disable-next-line no-console
      console.log(this.formatMessage("debug", message, context));
    }
  }

  info(message: string, context?: LogContext) {
    // eslint-disable-next-line no-console
    console.info(this.formatMessage("info", message, context));
  }

  warn(message: string, context?: LogContext) {
    // eslint-disable-next-line no-console
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

    // eslint-disable-next-line no-console
    console.error(this.formatMessage("error", message, errorContext));

    // Send to Sentry in production
    if (!this.isDev) {
      const event: PendingSentryEvent = {
        message,
        error,
        context,
        errorContext,
        loggedAt: new Date().toISOString(),
      };
      const sentry = loadSentry();

      if (sentry?.getClient?.()) {
        // Drain anything held from before init so it keeps its ordering.
        flushPendingSentryEvents();
        try {
          captureWithSentry(sentry, event);
        } catch {
          // Fail silently if Sentry rejects the event.
        }
      } else if (pendingSentryEvents.length < MAX_PENDING_SENTRY_EVENTS) {
        pendingSentryEvents.push(event);
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
    if (status >= 500) {
      // Server errors are real problems -> Sentry event via error().
      this.error(`API Error Response: ${method} ${url} - ${status}`, undefined, {
        method,
        url,
        status,
        data: truncateData(data),
      });
    } else if (status >= 400) {
      // Client errors (401/404/409/...) are expected outcomes. Log at warn for
      // dev visibility; the Sentry RN integration already records the xhr as a
      // breadcrumb, so we do NOT send a separate Sentry event.
      this.warn(`API Error Response: ${method} ${url} - ${status}`, {
        method,
        url,
        status,
        data: truncateData(data),
      });
    } else {
      this.debug(`API Response: ${method} ${url} - ${status}`, {
        method,
        url,
        status,
        data: truncateData(data),
      });
    }
  }

  logApiError(method: string, url: string, error: unknown) {
    this.error(`API Error: ${method} ${url}`, error, {
      method,
      url,
    });
  }

  private sanitizeHeaders(headers?: Record<string, string>): Record<string, string> {
    if (!headers) return {};

    const sanitized: Record<string, string> = {};

    // Mask sensitive headers (case-insensitive check)
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_HEADERS.includes(lowerKey)) {
        // Show first 10 chars to help with debugging, then mask
        sanitized[key] = value.length > 10 ? `${value.substring(0, 10)}...` : "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

export const logger = new Logger();
