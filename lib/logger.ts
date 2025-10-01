type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogContext {
  userId?: string;
  festivalId?: string;
  component?: string;
  action?: string;
  requestId?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
}

class Logger {
  private logLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === "development";
    this.logLevel = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel;
    if (
      envLevel &&
      ["TRACE", "DEBUG", "INFO", "WARN", "ERROR"].includes(envLevel)
    ) {
      return envLevel;
    }
    return this.isDevelopment ? "DEBUG" : "WARN";
  }

  private getLevelPriority(level: LogLevel): number {
    const priorities = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4 };
    return priorities[level];
  }

  private shouldLog(level: LogLevel): boolean {
    return this.getLevelPriority(level) >= this.getLevelPriority(this.logLevel);
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, context, error } = entry;

    if (this.isDevelopment) {
      // Development: Clean, readable format
      let output = `[${level}] ${message}`;

      if (context && Object.keys(context).length > 0) {
        const contextStr = Object.entries(context)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => `${key}=${value}`)
          .join(" ");
        output += ` | ${contextStr}`;
      }

      if (error) {
        output += `\n  Error: ${error.message}`;
        if (error.stack) {
          output += `\n  Stack: ${error.stack}`;
        }
      }

      return output;
    } else {
      // Production: Structured JSON format
      const logData: any = {
        timestamp,
        level,
        message,
        env: process.env.NODE_ENV,
      };

      if (context) {
        logData.context = context;
      }

      if (error) {
        logData.error = {
          message: error.message,
          name: error.name,
          stack: error.stack,
        };
      }

      return JSON.stringify(logData);
    }
  }

  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };

    const formattedMessage = this.formatLogEntry(entry);

    // Output to appropriate console method
    switch (level) {
      case "TRACE":
      case "DEBUG":
        // eslint-disable-next-line no-console
        console.debug(formattedMessage);
        break;
      case "INFO":
        // eslint-disable-next-line no-console
        console.info(formattedMessage);
        break;
      case "WARN":
        // eslint-disable-next-line no-console
        console.warn(formattedMessage);
        break;
      case "ERROR":
        // eslint-disable-next-line no-console
        console.error(formattedMessage);
        // In production, you might want to send to external logging service
        if (!this.isDevelopment && error) {
          // Integration with Sentry or other error reporting service
          if (typeof window !== "undefined" && window.Sentry) {
            window.Sentry.captureException(error, {
              contexts: { custom: context },
            });
          }
        }
        break;
    }
  }

  trace(message: string, context?: LogContext): void {
    this.log("TRACE", message, context);
  }

  debug(message: string, context?: LogContext): void {
    this.log("DEBUG", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("INFO", message, context);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log("WARN", message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log("ERROR", message, context, error);
  }

  // Utility methods for common logging scenarios
  serverAction(
    action: string,
    context?: Omit<LogContext, "component">,
  ): LogContext {
    return { ...context, component: "server-action", action };
  }

  clientComponent(
    component: string,
    context?: Omit<LogContext, "component">,
  ): LogContext {
    return { ...context, component };
  }

  apiRoute(route: string, context?: Omit<LogContext, "component">): LogContext {
    return { ...context, component: "api-route", action: route };
  }

  serviceWorker(context?: Omit<LogContext, "component">): LogContext {
    return { ...context, component: "service-worker" };
  }

  database(query: string, context?: Omit<LogContext, "action">): LogContext {
    return { ...context, component: "database", action: query };
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for use in other files
export type { LogContext, LogLevel };
