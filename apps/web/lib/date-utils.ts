/**
 * Utility functions for date and timezone handling
 */

import { TZDate } from "@date-fns/tz";
import { TIMEZONE } from "@prostcounter/shared";
import { format } from "date-fns";

/**
 * Formats a Date object for use with HTML datetime-local input
 * Converts the date to local timezone and returns ISO string format
 *
 * @param date - The date to format
 * @returns ISO string in format "YYYY-MM-DDTHH:mm" for datetime-local input
 *
 * @example
 * ```ts
 * const date = new Date('2024-09-15T18:00:00Z');
 * const formatted = formatDateForDatetimeLocal(date);
 * // Returns: "2024-09-15T18:00" (adjusted for local timezone)
 * ```
 */
export function formatDateForDatetimeLocal(date: Date): string {
  // Get the local timezone
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzDate = new TZDate(date, localTimezone);
  return format(tzDate, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Creates a datetime-local formatted string for a specific date and time
 *
 * @param date - The base date
 * @param hours - Hours to set (0-23)
 * @param minutes - Minutes to set (0-59)
 * @returns ISO string in format "YYYY-MM-DDTHH:mm" for datetime-local input
 *
 * @example
 * ```ts
 * const date = new Date('2024-09-15');
 * const formatted = createDatetimeLocalString(date, 18, 0);
 * // Returns: "2024-09-15T18:00" (adjusted for local timezone)
 * ```
 */
export function createDatetimeLocalString(
  date: Date,
  hours: number = 18,
  minutes: number = 0,
): string {
  const newDate = new Date(date);
  newDate.setHours(hours, minutes, 0, 0);
  return formatDateForDatetimeLocal(newDate);
}

/**
 * Formats a date in a specific timezone for datetime-local input
 * Useful for festival-specific timezone handling
 *
 * @param date - The date to format
 * @param timezone - The target timezone (e.g., 'Europe/Berlin')
 * @param hours - Hours to set (0-23)
 * @param minutes - Minutes to set (0-59)
 * @returns ISO string in format "YYYY-MM-DDTHH:mm" in the specified timezone
 *
 * @example
 * ```ts
 * const date = new Date('2024-09-15T16:00:00Z');
 * const formatted = formatDateInTimezone(date, 'Europe/Berlin', 18, 0);
 * // Returns: "2024-09-15T18:00" (in Berlin timezone)
 * ```
 */
export function formatDateInTimezone(
  date: Date,
  timezone: string,
  hours: number = 18,
  minutes: number = 0,
): string {
  // Create a new date with the specified time in the target timezone
  const dateInTimezone = new Date(date);
  dateInTimezone.setHours(hours, minutes, 0, 0);

  const tzDate = new TZDate(dateInTimezone, timezone);
  return format(tzDate, "yyyy-MM-dd'T'HH:mm");
}

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
 *
 * @param date - The date to format
 * @param timezone - Optional timezone (defaults to festival timezone)
 * @returns Relative time string (e.g., "2 minutes ago", "1 hour ago", "2 days ago", "1 week ago")
 */
export function formatRelativeTime(
  date: Date,
  timezone: string = TIMEZONE,
): string {
  const now = new TZDate(new Date(), timezone);
  const tzDate = new TZDate(date, timezone);
  const diffInSeconds = Math.floor((now.getTime() - tzDate.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

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
