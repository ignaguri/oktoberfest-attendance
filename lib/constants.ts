import type { WinningCriteria } from "./types";

export const winningCriteriaText: Record<WinningCriteria, string> = {
  days_attended: "Most Days Attended",
  total_beers: "Most Beers Drank",
  avg_beers: "Best Average Beers per Day",
};

export const PROD_URL = "https://prostcounter.fun";
export const DEV_URL = "http://localhost:3008";

export const GA_ID = "G-HL3ZYBCMN2";
export const IS_PROD = process.env.NODE_ENV === "production";

// Define the UTC+1 time zone (e.g., 'Europe/Berlin' for CET/CEST)
export const TIMEZONE = "Europe/Berlin";

export const NO_ROWS_ERROR = "PGRST116";

// Default avatar URL for users without profile pictures
export const DEFAULT_AVATAR_URL =
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face";

// Base64 placeholder for image loading states - light gray with subtle pattern
export const IMAGE_PLACEHOLDER_BASE64 =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0wIDBIMjAwVjIwMEgwVjBaIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEgxODBWMjBIMjBaIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCA0MEgxODBWMzBIMjBaIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCA2MEgxODBWNTVIMjBaIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCA4MEgxODBWNzVIMjBaIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAxMDBIMTgwVjk1SDIwWiIgZmlsbD0iI0YzRjRGNiIvPgo8cGF0aCBkPSJNMjAgMTIwSDE4MFYxMTVIMjBaIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAxNDBIMTgwVjEzNUgyMFoiIGZpbGw9IiNGM0Y0RjYiLz4KPHBhdGggZD0iTTIwIDE2MEgxODBWMTU1SDIwWiIgZmlsbD0iI0YzRjRGNiIvPgo8cGF0aCBkPSJNMjAgMTgwSDE4MFYxNzVIMjBaIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEgxODBWMjBIMjBaIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCA0MEgxODBWMzBIMjBaIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCA2MEgxODBWNTVIMjBaIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCA4MEgxODBWNzVIMjBaIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAxMDBIMTgwVjk1SDIwWiIgZmlsbD0iI0YzRjRGNiIvPgo8cGF0aCBkPSJNMjAgMTIwSDE4MFYxMTVIMjBaIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAxNDBIMTgwVjEzNUgyMFoiIGZpbGw9IiNGM0Y0RjYiLz4KPHBhdGggZD0iTTIwIDE2MEgxODBWMTU1SDIwWiIgZmlsbD0iI0YzRjRGNiIvPgo8cGF0aCBkPSJNMjAgMTgwSDE4MFYxNzVIMjBaIiBmaWxsPSIjRjNGNEY2Ii8+Cjwvc3ZnPgo=";
