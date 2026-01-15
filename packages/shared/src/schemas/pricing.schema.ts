import { z } from "zod";

import { DrinkTypeSchema } from "./consumption.schema";

/**
 * Drink type pricing record
 */
export const DrinkTypePriceSchema = z.object({
  id: z.uuid(),
  festivalId: z.uuid().nullable(),
  festivalTentId: z.uuid().nullable(),
  drinkType: DrinkTypeSchema,
  priceCents: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DrinkTypePrice = z.infer<typeof DrinkTypePriceSchema>;

/**
 * Price source - indicates where the price came from
 */
export const PriceSourceSchema = z.enum(["tent", "festival", "default"]);
export type PriceSource = z.infer<typeof PriceSourceSchema>;

/**
 * Request to get price for a drink type
 */
export const GetDrinkPriceQuerySchema = z.object({
  festivalId: z.uuid(),
  tentId: z.uuid().optional(),
  drinkType: DrinkTypeSchema.default("beer"),
});

export type GetDrinkPriceQuery = z.infer<typeof GetDrinkPriceQuerySchema>;

/**
 * Response with resolved price
 */
export const GetDrinkPriceResponseSchema = z.object({
  priceCents: z.number().int(),
  source: PriceSourceSchema,
});

export type GetDrinkPriceResponse = z.infer<typeof GetDrinkPriceResponseSchema>;

/**
 * All prices for a festival (keyed by drink type)
 */
export const FestivalPricesSchema = z.object({
  festivalId: z.uuid(),
  prices: z.record(DrinkTypeSchema, z.number().int().positive()),
});

export type FestivalPrices = z.infer<typeof FestivalPricesSchema>;

/**
 * System default prices (in cents)
 */
export const DEFAULT_DRINK_PRICES = {
  beer: 1620,
  radler: 1620,
  wine: 1400,
  soft_drink: 650,
  alcohol_free: 1450,
  other: 1620,
} as const;
