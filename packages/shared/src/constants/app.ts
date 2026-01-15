/**
 * Application constants shared across web and mobile
 */

// API URLs
export const PROD_URL = "https://prostcounter.fun";
export const DEV_URL = "http://localhost:3008";

// Environment detection
export const IS_PROD = process.env.NODE_ENV === "production";

// Default timezone for festival dates (Europe/Berlin for CET/CEST)
// Note: Festival-specific timezone should come from database via FestivalContext
export const DEFAULT_TIMEZONE = "Europe/Berlin";

// Alias for backward compatibility
export const TIMEZONE = DEFAULT_TIMEZONE;

// Supabase/PostgREST error codes
export const NO_ROWS_ERROR = "PGRST116";
