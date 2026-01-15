/**
 * Hook for getting drink prices based on festival and drink type
 *
 * Price resolution cascade:
 * 1. Festival-specific price (from festival beerCost for beer type)
 * 2. System default prices by drink type
 *
 * Note: In the future, this can be extended to call the pricing API
 * for tent-specific overrides and more granular pricing.
 */

import { useCallback, useMemo } from "react";

import type { DrinkType } from "../schemas/consumption.schema";
import { DEFAULT_DRINK_PRICES } from "../schemas/pricing.schema";

interface UseDrinkPriceOptions {
  /**
   * Festival beer cost in euros (optional)
   * If provided, used for beer and radler pricing
   */
  festivalBeerCost?: number | null;
}

export interface UseDrinkPriceReturn {
  /**
   * Get price in cents for a specific drink type
   */
  getDrinkPriceCents: (drinkType: DrinkType, tentId?: string) => number;
  /**
   * Get all default prices for the current festival
   */
  prices: Record<DrinkType, number>;
}

/**
 * Convert euros to cents (multiply by 100)
 */
function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

/**
 * Shared hook for getting drink prices
 * @param options - Optional configuration including festival beer cost
 */
export function useDrinkPrice(
  options: UseDrinkPriceOptions = {},
): UseDrinkPriceReturn {
  const { festivalBeerCost } = options;

  /**
   * Build prices map with festival overrides
   * Currently only beer has a festival-specific price (beerCost)
   */
  const prices = useMemo<Record<DrinkType, number>>(() => {
    const basePrices: Record<DrinkType, number> = { ...DEFAULT_DRINK_PRICES };

    // If festival has a specific beer cost, use it
    if (festivalBeerCost) {
      basePrices.beer = eurosToCents(festivalBeerCost);
      // Radler typically has same price as beer
      basePrices.radler = eurosToCents(festivalBeerCost);
    }

    return basePrices;
  }, [festivalBeerCost]);

  /**
   * Get price for a specific drink type
   * In the future, this can call the API for tent-specific overrides
   */
  const getDrinkPriceCents = useCallback(
    (drinkType: DrinkType, _tentId?: string): number => {
      // TODO: When pricing API is available, check tent-specific price first
      // For now, use festival/default prices
      return prices[drinkType] ?? DEFAULT_DRINK_PRICES.beer;
    },
    [prices],
  );

  return {
    getDrinkPriceCents,
    prices,
  };
}
