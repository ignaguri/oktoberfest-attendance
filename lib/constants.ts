import { WinningCriteria } from "./types";

export const BEGINNING_OF_WIESN = new Date("2024-09-21");
export const END_OF_WIESN = new Date("2024-10-06");

export const winningCriteriaText: Record<WinningCriteria, string> = {
  days_attended: "Most Days Attended",
  total_beers: "Most Beers Drunk",
  avg_beers: "Best Average Beers per Day",
};

export const COST_PER_BEER = 15.5;

export const PROD_URL = "https://prostcounter.fun";
export const DEV_URL = "http://localhost:3000";
