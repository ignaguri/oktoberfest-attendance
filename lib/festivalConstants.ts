import {
  parseISO,
  isAfter,
  isBefore,
  isWithinInterval,
  startOfDay,
  endOfDay,
} from "date-fns";

import type { Festival, FestivalTentPricing } from "./types";

// Default fallback values for when festival data is not available
export const DEFAULT_BEER_COST = 16.2;
export const DEFAULT_MAP_URL = "https://wiesnmap.muenchen.de/";

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
    festivalStartDate: parseISO(festival.start_date),
    festivalEndDate: parseISO(festival.end_date),
    festivalMapUrl: festival.map_url,
    timezone: festival.timezone,
    festivalName: festival.name,
    festivalLocation: festival.location,
  };
}

export function isFestivalActive(festival: Festival): boolean {
  const now = new Date();
  const startDate = parseISO(festival.start_date);
  const endDate = parseISO(festival.end_date);

  return isWithinInterval(now, { start: startDate, end: endDate });
}

export function isFestivalUpcoming(festival: Festival): boolean {
  const now = new Date();
  const startDate = parseISO(festival.start_date);

  return isBefore(now, startDate);
}

export function isFestivalEnded(festival: Festival): boolean {
  const now = new Date();
  const endDate = parseISO(festival.end_date);

  return isAfter(now, endDate);
}

export function getFestivalStatus(
  festival: Festival,
): "upcoming" | "active" | "ended" {
  if (isFestivalUpcoming(festival)) return "upcoming";
  if (isFestivalActive(festival)) return "active";
  return "ended";
}

// Helper function to get beer cost for a specific tent at a specific festival
export function getTentBeerCost(
  tentPricing: FestivalTentPricing[],
  tentId: string,
): number {
  const tentPrice = tentPricing.find((tp) => tp.tent_id === tentId);

  if (!tentPrice) {
    return DEFAULT_BEER_COST;
  }

  return tentPrice.beer_price;
}

// Helper function to get default beer cost for a festival
export function getDefaultBeerCost(festival: Festival | null): number {
  if (!festival) {
    return DEFAULT_BEER_COST;
  }

  // This could be enhanced to get the average beer cost across all tents
  // For now, return the default
  return DEFAULT_BEER_COST;
}

// Helper function to get festival dates as Date objects
export function getFestivalDates(festival: Festival | null): {
  startDate: Date;
  endDate: Date;
} | null {
  if (!festival) {
    return null;
  }

  return {
    startDate: parseISO(festival.start_date),
    endDate: parseISO(festival.end_date),
  };
}

// Helper function to check if a date is within festival period
export function isDateInFestivalPeriod(
  date: Date,
  festival: Festival | null,
): boolean {
  if (!festival) {
    return false;
  }

  const startDate = parseISO(festival.start_date);
  const endDate = parseISO(festival.end_date);

  return isWithinInterval(date, { start: startDate, end: endDate });
}

// Helper function to get festival map URL with fallback
export function getFestivalMapUrl(festival: Festival | null): string | null {
  if (!festival) {
    return DEFAULT_MAP_URL;
  }

  return festival.map_url || DEFAULT_MAP_URL;
}

// Helper function to get festival timezone with fallback
export function getFestivalTimezone(festival: Festival | null): string {
  if (!festival) {
    return "Europe/Berlin"; // Default timezone
  }

  return festival.timezone || "Europe/Berlin";
}

// Helper function to get festival start and end dates as Date objects with time boundaries
export function getFestivalDateBoundaries(festival: Festival | null): {
  startDate: Date;
  endDate: Date;
} | null {
  if (!festival) {
    return null;
  }

  const startDate = startOfDay(parseISO(festival.start_date));
  const endDate = endOfDay(parseISO(festival.end_date));

  return { startDate, endDate };
}

// Helper function to check if a date is exactly on festival start or end
export function isFestivalBoundaryDate(
  date: Date,
  festival: Festival | null,
): boolean {
  if (!festival) {
    return false;
  }

  const startDate = startOfDay(parseISO(festival.start_date));
  const endDate = startOfDay(parseISO(festival.end_date));
  const checkDate = startOfDay(date);

  return (
    checkDate.getTime() === startDate.getTime() ||
    checkDate.getTime() === endDate.getTime()
  );
}
