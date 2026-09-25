/**
 * Application constants shared across web and mobile
 */

// API URLs
export const PROD_URL = "https://prostcounter.fun";
export const DEV_URL = "http://localhost:3008";

/** Public contact inbox, shown on the privacy page and used for signed-out feedback links. */
export const CONTACT_EMAIL = "prostcounter@gmail.com";

export const INSTAGRAM_URL = "https://www.instagram.com/prostcounter/";

// Environment detection
export const IS_PROD = process.env.NODE_ENV === "production";

// Default timezone for festival dates (Europe/Berlin for CET/CEST)
// Note: Festival-specific timezone should come from database via FestivalContext
export const DEFAULT_TIMEZONE = "Europe/Berlin";

// Alias for backward compatibility
export const TIMEZONE = DEFAULT_TIMEZONE;
