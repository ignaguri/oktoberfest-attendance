/**
 * Hook for getting drink prices based on festival and drink type
 *
 * Price resolution cascade:
 * 1. The festival's own price for that drink type
 * 2. The festival's beer cost, for beer and radler
 * 3. System default prices by drink type
 *
 * This mirrors `get_drink_price_cents`, which is what the server stores a
 * consumption at. It is deliberately an estimate: per-tent overrides live
 * server-side, so a tent dearer than its festival is corrected when the row
 * syncs rather than predicted here.
 */

import { useCallback, useMemo } from "react";

import type { DrinkType } from "../schemas/consumption.schema";
import type { FestivalDrinkPrices } from "../schemas/festival.schema";
import { DEFAULT_DRINK_PRICES } from "../schemas/pricing.schema";
import { resolveFestivalDrinkPrices } from "../utils/pricing";

interface UseDrinkPriceOptions {
  /**
   * Festival beer cost in euros (optional)
   * If provided, used for beer and radler pricing
   */
  festivalBeerCost?: number | null;
  /**
   * The festival's per-drink-type price sheet, in cents.
   *
   * Without this every drink was priced as beer, so a soft drink was logged at
   * the beer price.
   */
  festivalDrinkPrices?: FestivalDrinkPrices | null;
}

export interface UseDrinkPriceReturn {
  /**
   * Get price in cents for a specific drink type
   */
  getDrinkPriceCents: (drinkType: DrinkType) => number;
  /**
   * Get all default prices for the current festival
   */
  prices: Record<DrinkType, number>;
}

/**
 * Shared hook for getting drink prices
 * @param options - Optional configuration including festival beer cost
 */
export function useDrinkPrice(options: UseDrinkPriceOptions = {}): UseDrinkPriceReturn {
  const { festivalBeerCost, festivalDrinkPrices } = options;

  const prices = useMemo<Record<DrinkType, number>>(
    () => resolveFestivalDrinkPrices(festivalBeerCost, festivalDrinkPrices),
    [festivalBeerCost, festivalDrinkPrices],
  );

  const getDrinkPriceCents = useCallback(
    (drinkType: DrinkType): number => {
      return prices[drinkType] ?? DEFAULT_DRINK_PRICES.beer;
    },
    [prices],
  );

  return {
    getDrinkPriceCents,
    prices,
  };
}
