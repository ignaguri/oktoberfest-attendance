import type { Festival } from "@prostcounter/shared/schemas";
import { getFestivalStatus } from "@prostcounter/shared/utils";
import { parseISO } from "date-fns";

import type { FestivalStatus, FestivalTent } from "./types";
import type { ShadcnBadgeVariant } from "./ui-adapters";

export { getFestivalStatus } from "@prostcounter/shared/utils";

// Avatar-style initials for a festival, e.g. "O" + "26" for "Oktoberfest 2026"
export function getFestivalDisplayInfo(festival: Festival) {
  const firstLetter = festival.name.charAt(0).toUpperCase();
  const yearMatch = festival.name.match(/(\d{4})/);
  const lastTwoDigits = yearMatch ? yearMatch[1].slice(-2) : "??";
  return { firstLetter, lastTwoDigits };
}

export function getFestivalStatusBadgeProps(festival: Festival): {
  status: FestivalStatus;
  variant: ShadcnBadgeVariant;
} {
  const status = getFestivalStatus(festival);

  if (status === "upcoming") {
    return { status, variant: "default" };
  } else if (status === "active") {
    return { status, variant: "success" };
  } else {
    return { status, variant: "secondary" };
  }
}

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

// Helper function to get beer cost for a specific tent at a specific festival
export function getTentBeerCost(festivalTents: FestivalTent[], tentId: string): number {
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
