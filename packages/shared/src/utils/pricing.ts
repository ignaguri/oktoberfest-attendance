/**
 * Tip calculation utilities
 *
 * Calculates the price paid (including tip) based on the user's
 * preferred tip mode and base drink price.
 */

export type TipMode =
  | "none"
  | "ceiling_plus_1"
  | "ceiling_plus_2"
  | "percentage_10"
  | "fixed";

export const TIP_MODES: TipMode[] = [
  "none",
  "ceiling_plus_1",
  "ceiling_plus_2",
  "percentage_10",
  "fixed",
];

/**
 * Calculate the total price paid (base + tip) based on the tip mode.
 *
 * @param basePriceCents - The base drink price in cents
 * @param tipMode - The user's tip calculation preference
 * @param fixedAmountEuros - Fixed tip amount in euros (only used when tipMode = 'fixed')
 * @returns The total price paid in cents (always >= basePriceCents)
 *
 * @example
 * // ceiling_plus_1: €14.70 → ceil(14.70)=15 + 1 = €16.00
 * calculatePricePaidCents(1470, 'ceiling_plus_1') // 1600
 *
 * // percentage_10: €14.70 → 14.70 * 1.10 = 16.17 → round to €16.00
 * calculatePricePaidCents(1470, 'percentage_10') // 1600
 *
 * // fixed: €14.70 + €1.50 tip = €16.20
 * calculatePricePaidCents(1470, 'fixed', 1.5) // 1620
 */
export function calculatePricePaidCents(
  basePriceCents: number,
  tipMode: TipMode,
  fixedAmountEuros?: number | null,
): number {
  switch (tipMode) {
    case "none":
      return basePriceCents;
    case "ceiling_plus_1":
      return (Math.ceil(basePriceCents / 100) + 1) * 100;
    case "ceiling_plus_2":
      return (Math.ceil(basePriceCents / 100) + 2) * 100;
    case "percentage_10":
      return Math.round((basePriceCents * 1.1) / 100) * 100;
    case "fixed":
      return basePriceCents + Math.round((fixedAmountEuros ?? 0) * 100);
  }
}
