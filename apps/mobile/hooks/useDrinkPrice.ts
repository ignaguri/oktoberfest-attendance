/**
 * Mobile-specific wrapper for the shared useDrinkPrice hook
 *
 * This wrapper integrates with the mobile FestivalContext to automatically
 * provide the current festival's beer cost to the shared hook.
 */

import { useDrinkPrice as useSharedDrinkPrice } from "@prostcounter/shared/hooks";

import { useFestival } from "@/lib/festival/FestivalContext";

/**
 * Mobile hook for getting drink prices
 * Automatically uses the current festival's beer cost from FestivalContext
 */
export function useDrinkPrice() {
  const { currentFestival } = useFestival();

  return useSharedDrinkPrice({
    festivalBeerCost: currentFestival?.beerCost,
  });
}
