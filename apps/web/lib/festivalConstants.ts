import { parseISO, isBefore, isWithinInterval, endOfDay } from "date-fns";

import type { FestivalTent } from "./types";
import type { Festival } from "@prostcounter/shared/schemas";

// Default fallback values for when festival data is not available
const DEFAULT_BEER_COST = 16.2;

interface FestivalConstants {
  festivalStartDate: Date;
  festivalEndDate: Date;
  festivalMapUrl: string | null;
  timezone: string | null;
  festivalName: string;
  festivalLocation: string | null;
}

export function getFestivalConstants(festival: Festival): FestivalConstants {
  return {
    festivalStartDate: parseISO(festival.startDate),
    festivalEndDate: parseISO(festival.endDate),
    festivalMapUrl: festival.mapUrl,
    timezone: festival.timezone,
    festivalName: festival.name,
    festivalLocation: festival.location,
  };
}

function isFestivalActive(festival: Festival): boolean {
  const now = new Date();
  const startDate = parseISO(festival.startDate);
  const endDate = endOfDay(parseISO(festival.endDate));

  return isWithinInterval(now, { start: startDate, end: endDate });
}

function isFestivalUpcoming(festival: Festival): boolean {
  const now = new Date();
  const startDate = parseISO(festival.startDate);

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
  festivalTents: FestivalTent[],
  tentId: string,
): number {
  const tentPrice = festivalTents.find((ft) => ft.tent_id === tentId);

  if (!tentPrice || !tentPrice.beer_price) {
    return DEFAULT_BEER_COST;
  }

  return tentPrice.beer_price;
}

// Helper function to get default beer cost for a festival
export function getDefaultBeerCost(festival: Festival | null): number {
  if (!festival) {
    return DEFAULT_BEER_COST;
  }

  // Use festival's beer cost or default fallback
  return festival.beerCost || DEFAULT_BEER_COST;
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
    startDate: parseISO(festival.startDate),
    endDate: parseISO(festival.endDate),
  };
}
