/**
 * Parsing and display for a tent's beer price, as typed into an admin field.
 *
 * The API takes euros as a positive number or null, mirroring
 * `drink_type_prices_positive_price` -- there is no zero price, an absent one
 * is null.
 */

/** An empty field means "no price", anything unparseable is rejected. */
export type ParsedPrice = number | null | "invalid";

/**
 * Reads a typed price.
 *
 * Accepts a comma decimal separator because a German keyboard offers that one,
 * and the app's largest audience types on one.
 */
export function parsePriceInput(value: string): ParsedPrice {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return "invalid";
  }

  return parsed;
}

/** Formats a stored price back into a field, blank when there is none. */
export function formatPriceInput(beerPrice: number | null): string {
  return beerPrice === null ? "" : String(beerPrice);
}
