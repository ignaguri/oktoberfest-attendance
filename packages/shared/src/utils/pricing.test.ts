import { describe, expect, it } from "vitest";

import { DEFAULT_DRINK_PRICES } from "../schemas/pricing.schema";

import { resolveFestivalDrinkPrices } from "./pricing";

/**
 * What a client thinks a drink costs. This used to be beer's price for every
 * drink type, which is how two Spezis reached production logged at 15.80.
 *
 * The expectations here deliberately mirror the first two rungs of
 * `get_drink_price_cents`, since a disagreement between the two shows up as a
 * price that changes under the user after their row syncs.
 */
describe("resolveFestivalDrinkPrices", () => {
  it("falls back to system defaults when the festival prices nothing", () => {
    expect(resolveFestivalDrinkPrices(null, null)).toEqual(DEFAULT_DRINK_PRICES);
  });

  it("prices each drink type from the festival's own sheet", () => {
    const prices = resolveFestivalDrinkPrices(15.8, {
      beer: 1580,
      soft_drink: 632,
      wine: 1343,
    });

    expect(prices.beer).toBe(1580);
    expect(prices.soft_drink).toBe(632);
    expect(prices.wine).toBe(1343);
  });

  it("leaves unpriced types on the system default", () => {
    const prices = resolveFestivalDrinkPrices(15.8, { beer: 1580 });

    expect(prices.alcohol_free).toBe(DEFAULT_DRINK_PRICES.alcohol_free);
    expect(prices.other).toBe(DEFAULT_DRINK_PRICES.other);
  });

  it("applies beerCost to beer and radler when there is no sheet", () => {
    const prices = resolveFestivalDrinkPrices(15.8, {});

    expect(prices.beer).toBe(1580);
    expect(prices.radler).toBe(1580);
  });

  it("never lets beerCost decide what a soft drink costs", () => {
    const prices = resolveFestivalDrinkPrices(15.8, {});

    expect(prices.soft_drink).toBe(DEFAULT_DRINK_PRICES.soft_drink);
    expect(prices.soft_drink).not.toBe(1580);
  });

  it("prefers the sheet over beerCost when the two disagree", () => {
    // beerCost is the older column; an explicit price is a deliberate answer.
    const prices = resolveFestivalDrinkPrices(16.2, { beer: 1580, radler: 1580 });

    expect(prices.beer).toBe(1580);
    expect(prices.radler).toBe(1580);
  });

  it("ignores a zero or absent beerCost rather than pricing beer at nothing", () => {
    expect(resolveFestivalDrinkPrices(0, {}).beer).toBe(DEFAULT_DRINK_PRICES.beer);
    expect(resolveFestivalDrinkPrices(undefined, {}).beer).toBe(DEFAULT_DRINK_PRICES.beer);
  });

  it("rounds a fractional beerCost to whole cents", () => {
    expect(resolveFestivalDrinkPrices(15.805, {}).beer).toBe(1581);
  });
});
