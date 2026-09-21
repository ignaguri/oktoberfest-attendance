"use client";

/**
 * Web-specific wrapper for the shared useDrinkPrice hook
 *
 * This wrapper integrates with the web FestivalContext to automatically
 * provide the current festival's pricing to the shared hook.
 */

import { useFestival } from "@prostcounter/shared/contexts";
import {
  useDrinkPrice as useSharedDrinkPrice,
  type UseDrinkPriceReturn,
} from "@prostcounter/shared/hooks";

/**
 * Web hook for getting drink prices
 * Automatically uses the current festival's price sheet from FestivalContext
 */
export function useDrinkPrice(): UseDrinkPriceReturn {
  const { currentFestival } = useFestival();

  return useSharedDrinkPrice({
    festivalBeerCost: currentFestival?.beerCost,
    festivalDrinkPrices: currentFestival?.drinkPrices,
  });
}
