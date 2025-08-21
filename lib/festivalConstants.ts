import { parseISO, isBefore, isWithinInterval } from "date-fns";

import type { Festival, FestivalTentPricing } from "./types";

// Default fallback values for when festival data is not available
const DEFAULT_BEER_COST = 16.2;

interface FestivalConstants {
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

function isFestivalActive(festival: Festival): boolean {
  const now = new Date();
  const startDate = parseISO(festival.start_date);
  const endDate = parseISO(festival.end_date);

  return isWithinInterval(now, { start: startDate, end: endDate });
}

function isFestivalUpcoming(festival: Festival): boolean {
  const now = new Date();
  const startDate = parseISO(festival.start_date);

  return isBefore(now, startDate);
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
