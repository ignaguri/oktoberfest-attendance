/**
 * Utility functions for date and timezone handling
 */

import { TZDate } from "@date-fns/tz";
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
