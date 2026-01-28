/**
 * Centralized logging utility for the mobile app
 * Logs to console in development and can be extended to send to monitoring services
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

class Logger {
  private isDev = __DEV__;

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `\n${JSON.stringify(context, null, 2)}` : "";
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

    // TODO: Send to Sentry or other monitoring service in production
    // if (!this.isDev && typeof Sentry !== 'undefined') {
    //   Sentry.captureException(error, { contexts: { custom: context } });
    // }
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
      data:
        typeof data === "string" && data.length > 500
          ? `${data.substring(0, 500)}...`
          : data,
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

    const sanitized = { ...headers };

    // Mask sensitive headers
    if (sanitized.Authorization) {
      sanitized.Authorization =
        sanitized.Authorization.substring(0, 20) + "...";
    }

    return sanitized;
  }
}

export const logger = new Logger();
