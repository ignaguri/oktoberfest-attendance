import type { Festival } from "./types";

export interface FestivalConstants {
  festivalStartDate: Date;
  festivalEndDate: Date;
  festivalMapUrl: string | null;
  timezone: string;
  festivalName: string;
  festivalLocation: string;
}

export function getFestivalConstants(festival: Festival): FestivalConstants {
  return {
    festivalStartDate: new Date(festival.start_date),
    festivalEndDate: new Date(festival.end_date),
    festivalMapUrl: festival.map_url,
    timezone: festival.timezone,
    festivalName: festival.name,
    festivalLocation: festival.location,
  };
}

// Legacy constants for backward compatibility
// These should be replaced with dynamic festival data throughout the app
export const BEGINNING_OF_WIESN = new Date("2024-09-21");
export const END_OF_WIESN = new Date("2024-10-06");
export const WIESN_MAP_URL = "https://wiesnmap.muenchen.de/";
export const COST_PER_BEER = 16.2; // This will be replaced by tent-specific pricing

// Default Oktoberfest 2024 constants for fallback
export const DEFAULT_OKTOBERFEST_2024: FestivalConstants = {
  festivalStartDate: BEGINNING_OF_WIESN,
  festivalEndDate: END_OF_WIESN,
  festivalMapUrl: WIESN_MAP_URL,
  timezone: "Europe/Berlin",
  festivalName: "Oktoberfest 2024",
  festivalLocation: "Munich, Germany",
};

export function isFestivalActive(festival: Festival): boolean {
  const now = new Date();
  const startDate = new Date(festival.start_date);
  const endDate = new Date(festival.end_date);

  return now >= startDate && now <= endDate;
}

export function isFestivalUpcoming(festival: Festival): boolean {
  const now = new Date();
  const startDate = new Date(festival.start_date);

  return now < startDate;
}

export function isFestivalEnded(festival: Festival): boolean {
  const now = new Date();
  const endDate = new Date(festival.end_date);

  return now > endDate;
}

export function getFestivalStatus(
  festival: Festival,
): "upcoming" | "active" | "ended" {
  if (isFestivalUpcoming(festival)) return "upcoming";
  if (isFestivalActive(festival)) return "active";
  return "ended";
}
