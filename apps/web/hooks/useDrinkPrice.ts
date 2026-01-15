"use client";

/**
 * Web-specific wrapper for the shared useDrinkPrice hook
 *
 * This wrapper integrates with the web FestivalContext to automatically
 * provide the current festival's beer cost to the shared hook.
 */

import { useFestival } from "@/contexts/FestivalContext";
import {
  useDrinkPrice as useSharedDrinkPrice,
  type UseDrinkPriceReturn,
} from "@prostcounter/shared/hooks";

/**
 * Web hook for getting drink prices
 * Automatically uses the current festival's beer cost from FestivalContext
 */
export function useDrinkPrice(): UseDrinkPriceReturn {
  const { currentFestival } = useFestival();

  return useSharedDrinkPrice({
    // Web Festival type uses snake_case (beer_cost from database)
    festivalBeerCost: currentFestival?.beer_cost,
  });
}
