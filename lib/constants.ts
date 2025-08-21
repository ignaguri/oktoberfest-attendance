import type { WinningCriteria } from "./types";

// DEPRECATED: These constants are hardcoded for Oktoberfest 2024
// Use getFestivalConstants() from ./festivalConstants.ts for dynamic values
// TODO: Remove these after all components are updated to use festival context
export const BEGINNING_OF_WIESN = new Date("2024-09-21");
export const END_OF_WIESN = new Date("2024-10-06");
export const WIESN_MAP_URL = "https://wiesnmap.muenchen.de/";
export const COST_PER_BEER = 16.2; // Will be replaced by tent-specific pricing

export const winningCriteriaText: Record<WinningCriteria, string> = {
  days_attended: "Most Days Attended",
  total_beers: "Most Beers Drank",
  avg_beers: "Best Average Beers per Day",
};

export const PROD_URL = "https://prostcounter.fun";
export const DEV_URL = "http://localhost:3000";

export const GA_ID = "G-HL3ZYBCMN2";
export const IS_PROD = process.env.NODE_ENV === "production";

// Define the UTC+1 time zone (e.g., 'Europe/Berlin' for CET/CEST)
export const TIMEZONE = "Europe/Berlin";

export const NO_ROWS_ERROR = "PGRST116";
