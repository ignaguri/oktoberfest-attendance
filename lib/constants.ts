import type { WinningCriteria } from "./types";

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
