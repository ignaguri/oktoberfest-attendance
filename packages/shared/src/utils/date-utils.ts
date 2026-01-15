/**
 * Shared date utility functions for web and mobile
 * These handle timezone-aware date formatting for database storage and display
 */

import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

import { TIMEZONE } from "../constants/app";
import { getCurrentLanguage } from "../i18n/core";

/**
 * Formats a date for database storage in YYYY-MM-DD format
 * Uses the festival timezone to ensure consistent date representation
 * This replaces the problematic toISOString().split('T')[0] pattern
 *
 * @param date - The date to format
 * @param timezone - Optional timezone (defaults to festival timezone)
 * @returns Date string in format "YYYY-MM-DD" in the specified timezone
 *
 * @example
 * ```ts
 * const date = new Date('2024-09-15T22:00:00Z'); // UTC
 * const formatted = formatDateForDatabase(date);
 * // Returns: "2024-09-16" (in Europe/Berlin timezone, next day)
 *
 * const localDate = new Date('2024-09-15T18:00:00');
 * const formatted = formatDateForDatabase(localDate);
 * // Returns: "2024-09-15" (in Europe/Berlin timezone)
 * ```
 */
export function formatDateForDatabase(
  date: Date,
  timezone: string = TIMEZONE,
): string {
  const tzDate = new TZDate(date, timezone);
  return format(tzDate, "yyyy-MM-dd");
}

/**
 * Formats a date for database storage as a full timestamp with timezone
 * Preserves the time information for tent visits and other timestamp fields
 * Uses the festival timezone to ensure consistent timestamp representation
 *
 * @param date - The date to format
 * @param timezone - Optional timezone (defaults to festival timezone)
 * @returns ISO timestamp string with timezone information
 *
 * @example
 * ```ts
 * const date = new Date('2024-09-15T22:00:00Z'); // UTC
 * const formatted = formatTimestampForDatabase(date);
 * // Returns: "2024-09-16T00:00:00.000+02:00" (in Europe/Berlin timezone)
 *
 * const localDate = new Date('2024-09-15T18:00:00');
 * const formatted = formatTimestampForDatabase(localDate);
 * // Returns: "2024-09-15T18:00:00.000+02:00" (in Europe/Berlin timezone)
 * ```
 */
export function formatTimestampForDatabase(
  date: Date,
  timezone: string = TIMEZONE,
): string {
  const tzDate = new TZDate(date, timezone);
  return tzDate.toISOString();
}

/**
 * Formats a date for relative time using Intl.RelativeTimeFormat
 * Uses the current i18n language for localized output (e.g., "vor 2 Stunden" in German)
 *
 * @param date - The date to format
 * @param timezone - Optional timezone (defaults to festival timezone)
 * @param locale - Optional locale for formatting (defaults to current i18n language)
 * @returns Relative time string (e.g., "2 minutes ago", "1 hour ago", "2 days ago", "1 week ago")
 */
export function formatRelativeTime(
  date: Date,
  timezone: string = TIMEZONE,
  locale?: string,
): string {
  const now = new TZDate(new Date(), timezone);
  const tzDate = new TZDate(date, timezone);
  const diffInSeconds = Math.floor((now.getTime() - tzDate.getTime()) / 1000);

  // Use provided locale, or fall back to current i18n language
  const language = locale ?? getCurrentLanguage();
  const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });

  if (diffInSeconds < 60) {
    return rtf.format(-diffInSeconds, "second");
  } else if (diffInSeconds < 3600) {
    return rtf.format(-Math.floor(diffInSeconds / 60), "minute");
  } else if (diffInSeconds < 86400) {
    return rtf.format(-Math.floor(diffInSeconds / 3600), "hour");
  } else if (diffInSeconds < 604800) {
    return rtf.format(-Math.floor(diffInSeconds / 86400), "day");
  } else {
    return rtf.format(-Math.floor(diffInSeconds / 604800), "week");
  }
}
