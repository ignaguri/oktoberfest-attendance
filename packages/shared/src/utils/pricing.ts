import type { DrinkType } from "../schemas/consumption.schema";
import { DEFAULT_DRINK_PRICES } from "../schemas/pricing.schema";

export type TipMode = "none" | "ceiling_plus_1" | "ceiling_plus_2" | "percentage_10" | "fixed";

export const TIP_MODES: TipMode[] = [
  "none",
  "ceiling_plus_1",
  "ceiling_plus_2",
  "percentage_10",
  "fixed",
];

/** i18n keys for tip mode labels */
const TIP_MODE_LABEL_KEYS: Record<TipMode, string> = {
  none: "profile.tipMode.none",
  ceiling_plus_1: "profile.tipMode.ceilingPlus1",
  ceiling_plus_2: "profile.tipMode.ceilingPlus2",
  percentage_10: "profile.tipMode.percentage10",
  fixed: "profile.tipMode.fixed",
};

/** i18n keys for tip mode descriptions */
const TIP_MODE_DESCRIPTION_KEYS: Record<TipMode, string> = {
  none: "profile.tipMode.noneDescription",
  ceiling_plus_1: "profile.tipMode.ceilingPlus1Description",
  ceiling_plus_2: "profile.tipMode.ceilingPlus2Description",
  percentage_10: "profile.tipMode.percentage10Description",
  fixed: "profile.tipMode.fixedDescription",
};

/** Get translated tip mode labels using a t() function */
export function getTipModeLabels(t: (key: string) => string): Record<TipMode, string> {
  return Object.fromEntries(
    TIP_MODES.map((mode) => [mode, t(TIP_MODE_LABEL_KEYS[mode])]),
  ) as Record<TipMode, string>;
}

/** Get translated tip mode descriptions using a t() function */
export function getTipModeDescriptions(t: (key: string) => string): Record<TipMode, string> {
  return Object.fromEntries(
    TIP_MODES.map((mode) => [mode, t(TIP_MODE_DESCRIPTION_KEYS[mode])]),
  ) as Record<TipMode, string>;
}

/** Result is always >= basePriceCents. percentage_10 rounds to nearest euro. */
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
    case "percentage_10": {
      const totalEurosRounded = Math.round((basePriceCents * 1.1) / 100);
      const totalCents = totalEurosRounded * 100;
      return Math.max(totalCents, basePriceCents);
    }
    case "fixed":
      return basePriceCents + Math.round(Math.max(fixedAmountEuros ?? 0, 0) * 100);
  }
}

/**
 * What each drink type costs at a festival, in cents, from the client's point
 * of view.
 *
 * Mirrors the first two rungs of `get_drink_price_cents`, which is what the
 * server actually stores a consumption at: the festival's own price for the
 * type, then its beer cost for beer-like drinks, then the system default.
 *
 * `beerCost` is applied before the sheet and overridden by it. It only ever
 * described beer, and a festival that prices beer explicitly means that price
 * rather than one derived from a column kept around for older clients.
 *
 * Per-tent overrides are deliberately absent. They live server-side, so a tent
 * dearer than its festival is corrected when the row syncs rather than guessed
 * at here.
 */
export function resolveFestivalDrinkPrices(
  festivalBeerCost?: number | null,
  festivalDrinkPrices?: Partial<Record<DrinkType, number>> | null,
): Record<DrinkType, number> {
  const prices: Record<DrinkType, number> = { ...DEFAULT_DRINK_PRICES };

  if (festivalBeerCost) {
    const beerCents = Math.round(festivalBeerCost * 100);
    prices.beer = beerCents;
    prices.radler = beerCents;
  }

  for (const [drinkType, priceCents] of Object.entries(festivalDrinkPrices ?? {})) {
    if (typeof priceCents === "number") {
      prices[drinkType as DrinkType] = priceCents;
    }
  }

  return prices;
}
