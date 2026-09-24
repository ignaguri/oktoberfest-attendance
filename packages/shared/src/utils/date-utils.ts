/**
 * Shared date utility functions for web and mobile
 * These handle timezone-aware date formatting for database storage and display
 */

import { TZDate } from "@date-fns/tz";
import { type FormatDistanceToken, format, type Locale } from "date-fns";
import { de, enUS, es } from "date-fns/locale";

import { TIMEZONE } from "../constants/app";
import { getCurrentLanguage, i18n } from "../i18n/core";

/**
 * Map of supported language codes to date-fns locales
 */
const localeMap: Record<string, Locale> = {
  en: enUS,
  de: de,
  es: es,
};

/**
 * Gets the date-fns locale for the current i18n language
 * Falls back to English if the language is not supported
 *
 * @returns date-fns Locale object for the current language
 */
export function getDateLocale(): Locale {
  const language = getCurrentLanguage();
  return localeMap[language] || enUS;
}

/**
 * Formats a date with localization support
 * Uses the current i18n language for localized month/day names
 *
 * @param date - The date to format
 * @param formatStr - The format string (date-fns format)
 * @returns Formatted date string with localized names
 *
 * @example
 * ```ts
 * // With German language active
 * formatLocalized(new Date(), "EEEE, MMMM d")
 * // Returns: "Montag, September 15"
 *
 * // With Spanish language active
 * formatLocalized(new Date(), "EEEE, MMMM d")
 * // Returns: "lunes, septiembre 15"
 * ```
 */
export function formatLocalized(date: Date, formatStr: string): string {
  return format(date, formatStr, { locale: getDateLocale() });
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
export function formatDateForDatabase(date: Date, timezone: string = TIMEZONE): string {
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
export function formatTimestampForDatabase(date: Date, timezone: string = TIMEZONE): string {
  const tzDate = new TZDate(date, timezone);
  return tzDate.toISOString();
}

/**
 * The instant at which a clock in `timezone` shows `time` on `day`.
 *
 * Pickers hand back device-local dates, so the calendar fields of `day` and the
 * hours and minutes of `time` are read in device-local time and reinterpreted
 * as festival wall-clock time. A phone set to another timezone then still
 * books the time the user picked, on the festival's own clock.
 */
export function atZonedTime(day: Date, time: Date, timezone: string = TIMEZONE): Date {
  return new Date(
    new TZDate(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      time.getHours(),
      time.getMinutes(),
      timezone,
    ).getTime(),
  );
}

/**
 * The inverse of atZonedTime: a device-local date on `day` whose hours and
 * minutes are what a clock in `timezone` shows at `instant`. This is the value
 * a time picker should display.
 */
export function zonedTimeOnDay(instant: Date, day: Date, timezone: string = TIMEZONE): Date {
  const zoned = new TZDate(instant, timezone);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    zoned.getHours(),
    zoned.getMinutes(),
  );
}

/** A time as a clock in `timezone` shows it, "HH:mm" by default. */
export function formatTimeInTimezone(
  date: Date,
  timezone: string = TIMEZONE,
  formatStr: string = "HH:mm",
): string {
  return format(new TZDate(date, timezone), formatStr);
}

/**
 * How far ahead of the device clock a server timestamp may sit before it reads
 * as a wait rather than as "now".
 */
const CLOCK_SKEW_SECONDS = 5;

/**
 * Formats a date for relative time using Intl.RelativeTimeFormat
 * Uses the current i18n language for localized output (e.g., "vor 2 Stunden" in German)
 *
 * @param date - The date to format
 * @param timezone - Optional timezone (defaults to festival timezone)
 * @param locale - Optional locale for formatting (defaults to current i18n language)
 * @returns Relative time string (e.g., "2 minutes ago", "1 hour ago", "in 2 hours")
 */
export function formatRelativeTime(
  date: Date,
  timezone: string = TIMEZONE,
  locale?: string,
): string {
  const now = new TZDate(new Date(), timezone);
  const tzDate = new TZDate(date, timezone);
  const diffInSeconds = Math.floor((now.getTime() - tzDate.getTime()) / 1000);
  // The unit comes from the distance, the direction from the sign. Selecting on
  // the signed value would send every future date down the seconds branch
  // ("in 7200 seconds" rather than "in 2 hours").
  const distanceInSeconds = Math.abs(diffInSeconds);

  // Intl.RelativeTimeFormat may not be fully available in Hermes (React Native).
  // On Android it's typically missing; on iOS it may pass the typeof check but
  // crash on instantiation ("Cannot read property 'prototype' of undefined").
  // Use it when available, otherwise fall back to simple English strings.
  if (typeof Intl?.RelativeTimeFormat === "function") {
    try {
      const language = locale ?? getCurrentLanguage();
      const rtf = new Intl.RelativeTimeFormat(language, { numeric: "auto" });

      if (distanceInSeconds < 60) {
        // Clamp to zero rather than to an English literal, so this stays
        // localized: format(0) is "now", "jetzt", "ahora".
        const seconds =
          diffInSeconds < 0 && distanceInSeconds < CLOCK_SKEW_SECONDS ? 0 : -diffInSeconds;
        return rtf.format(seconds, "second");
      } else if (distanceInSeconds < 3600) {
        return rtf.format(-Math.trunc(diffInSeconds / 60), "minute");
      } else if (distanceInSeconds < 86400) {
        return rtf.format(-Math.trunc(diffInSeconds / 3600), "hour");
      } else if (distanceInSeconds < 604800) {
        return rtf.format(-Math.trunc(diffInSeconds / 86400), "day");
      } else {
        return rtf.format(-Math.trunc(diffInSeconds / 604800), "week");
      }
    } catch {
      // Fall through to fallback below (Hermes may expose but not fully implement this API)
    }
  }

  // Fallback for runtimes without Intl.RelativeTimeFormat (e.g. Hermes), which
  // is the normal path on device. date-fns locale tokens phrase the amount in the
  // UI language without needing Intl at all.
  const language = locale ?? getCurrentLanguage();

  if (distanceInSeconds < 60) {
    // A server timestamp routinely lands a few seconds ahead of the device
    // clock. That is "just now", not a wait, and it is the common case here:
    // these strings mostly date freshly created rows.
    if (distanceInSeconds <= 1 || (diffInSeconds < 0 && distanceInSeconds < CLOCK_SKEW_SECONDS)) {
      return i18n.t("common.time.justNow", { lng: language }).toLocaleLowerCase(language);
    }
  }

  const dateLocale = localeMap[language] || enUS;
  const phrase = (token: FormatDistanceToken, amount: number) =>
    dateLocale.formatDistance(token, amount, {
      addSuffix: true,
      // Positive reads as "in X", negative as "X ago".
      comparison: diffInSeconds < 0 ? 1 : -1,
    });

  if (distanceInSeconds < 60) {
    return phrase("xSeconds", distanceInSeconds);
  } else if (distanceInSeconds < 3600) {
    return phrase("xMinutes", Math.floor(distanceInSeconds / 60));
  } else if (distanceInSeconds < 86400) {
    return phrase("xHours", Math.floor(distanceInSeconds / 3600));
  } else if (distanceInSeconds < 604800) {
    return phrase("xDays", Math.floor(distanceInSeconds / 86400));
  } else {
    return phrase("xWeeks", Math.floor(distanceInSeconds / 604800));
  }
}
