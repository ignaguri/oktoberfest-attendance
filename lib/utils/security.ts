import { logger } from "@/lib/logger";
import * as Sentry from "@sentry/nextjs";
import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize HTML input to prevent XSS attacks
 * Uses DOMPurify library for robust HTML sanitization
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Limit length first
  let sanitized = input.slice(0, maxLength);

  // Use DOMPurify to sanitize HTML and prevent XSS
  // This removes dangerous HTML tags, attributes, and scripts
  sanitized = DOMPurify.sanitize(sanitized, {
    ALLOWED_TAGS: [], // Strip all HTML tags by default for plain text
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // Keep text content but remove tags
  });

  // Remove null bytes and control characters
  sanitized = sanitized
    .replace(/\0/g, "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim();

  return sanitized;
}

/**
 * Sanitize HTML content while preserving safe HTML tags
 * Use this when you need to preserve formatting (e.g., rich text)
 */
export function sanitizeHTML(html: string, maxLength: number = 10000): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  // Limit length first
  let sanitized = html.slice(0, maxLength);

  // Use DOMPurify with default settings to allow safe HTML
  // This preserves safe tags like <p>, <b>, <i>, <strong>, <em>, etc.
  // while removing dangerous scripts, event handlers, and unsafe attributes
  sanitized = DOMPurify.sanitize(sanitized);

  return sanitized;
}

/**
 * Sanitize search term for database queries
 * Removes SQL wildcards and escape characters
 */
export function sanitizeSearchTerm(
  search: string,
  maxLength: number = 100,
): string {
  if (!search || typeof search !== "string") {
    return "";
  }

  // Remove SQL wildcards and escape characters that could be used for injection
  let sanitized = search
    .trim()
    .replace(/[%_\\]/g, "") // Remove SQL wildcards and backslashes
    .slice(0, maxLength);

  return sanitized;
}

/**
 * Validate email format (beyond Zod schema)
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }

  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return false;
  }

  // Check for common fake email patterns
  const fakeEmailPatterns = [
    /^test@/i,
    /@test\./i,
    /@example\./i,
    /@fake\./i,
    /@temp\./i,
    /@throwaway\./i,
  ];

  return !fakeEmailPatterns.some((pattern) => pattern.test(email));
}

/**
 * Validate username format
 */
export function isValidUsername(username: string): boolean {
  if (!username || typeof username !== "string") {
    return false;
  }

  // Username should be 3-30 characters, alphanumeric and underscores only
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
}

/**
 * Log security event to Sentry
 */
export function logSecurityEvent(
  eventType: string,
  details: Record<string, unknown>,
  level: "info" | "warning" | "error" = "warning",
): void {
  try {
    const context = {
      tags: {
        security_event: eventType,
      },
      extra: {
        ...details,
        timestamp: new Date().toISOString(),
      },
    };

    switch (level) {
      case "error":
        Sentry.captureException(new Error(`Security Event: ${eventType}`), {
          ...context,
          level: "error",
        });
        break;
      case "warning":
        Sentry.captureMessage(`Security Event: ${eventType}`, {
          ...context,
          level: "warning",
        });
        break;
      default:
        logger.info(`Security Event: ${eventType}`, details);
        break;
    }
  } catch (error) {
    // Fail silently if Sentry is not available
    logger.error("Failed to log security event", { error });
  }
}

/**
 * Log admin action for audit trail
 */
export function logAdminAction(
  userId: string,
  action: string,
  details: Record<string, unknown> = {},
): void {
  try {
    logSecurityEvent("admin_action", {
      userId,
      action,
      ...details,
    });

    // Also log to console in development
    if (process.env.NODE_ENV === "development") {
      logger.info("Admin Action", {
        userId,
        action,
        ...details,
      });
    }
  } catch (error) {
    logger.error("Failed to log admin action", { error });
  }
}
