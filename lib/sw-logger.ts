// Service Worker Logger
// Simplified logging for service worker context where imports are limited

type LogLevel = "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";

interface SWLogContext {
  component?: string;
  action?: string;
  [key: string]: unknown;
}

class SWLogger {
  private logLevel: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    // In SW context, we don't have access to process.env the same way
    // We'll default to DEBUG for development builds and WARN for production
    this.isDevelopment = typeof importScripts !== "undefined"; // SW context check
    this.logLevel = this.isDevelopment ? "DEBUG" : "WARN";
  }

  private getLevelPriority(level: LogLevel): number {
    const priorities = { TRACE: 0, DEBUG: 1, INFO: 2, WARN: 3, ERROR: 4 };
    return priorities[level];
  }

  private shouldLog(level: LogLevel): boolean {
    return this.getLevelPriority(level) >= this.getLevelPriority(this.logLevel);
  }

  private formatLogEntry(
    level: LogLevel,
    message: string,
    context?: SWLogContext,
    error?: Error,
  ): string {
    const timestamp = new Date().toISOString();

    if (this.isDevelopment) {
      // Development: Clean, readable format
      let output = `[SW-${level}] ${message}`;

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
        component: "service-worker",
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
    context?: SWLogContext,
    error?: Error,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatLogEntry(
      level,
      message,
      context,
      error,
    );

    // Output to appropriate console method
    switch (level) {
      case "TRACE":
      case "DEBUG":
        console.debug(formattedMessage);
        break;
      case "INFO":
        console.info(formattedMessage);
        break;
      case "WARN":
        console.warn(formattedMessage);
        break;
      case "ERROR":
        console.error(formattedMessage);
        break;
    }
  }

  trace(message: string, context?: SWLogContext): void {
    this.log("TRACE", message, context);
  }

  debug(message: string, context?: SWLogContext): void {
    this.log("DEBUG", message, context);
  }

  info(message: string, context?: SWLogContext): void {
    this.log("INFO", message, context);
  }

  warn(message: string, context?: SWLogContext, error?: Error): void {
    this.log("WARN", message, context, error);
  }

  error(message: string, context?: SWLogContext, error?: Error): void {
    this.log("ERROR", message, context, error);
  }

  // Utility methods for service worker specific logging
  serviceWorker(
    action: string,
    context?: Omit<SWLogContext, "component" | "action">,
  ): SWLogContext {
    return { ...context, component: "service-worker", action };
  }

  caching(
    action: string,
    context?: Omit<SWLogContext, "action">,
  ): SWLogContext {
    return { ...context, component: "sw-cache", action };
  }

  updateCheck(
    context?: Omit<SWLogContext, "component" | "action">,
  ): SWLogContext {
    return { ...context, component: "sw-update", action: "version-check" };
  }
}

// Export singleton instance for service worker
export const swLogger = new SWLogger();

// Export types
export type { LogLevel, SWLogContext };
