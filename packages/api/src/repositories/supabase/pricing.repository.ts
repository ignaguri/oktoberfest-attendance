import { DEFAULT_DRINK_PRICES } from "@prostcounter/shared";

import type { Database } from "@prostcounter/db";
import type {
  DrinkType,
  GetDrinkPriceResponse,
  PriceSource,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export class SupabasePricingRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Get price for a specific drink type at a festival/tent
   * Uses cascade: Tent override -> Festival default -> System default
   */
  async getDrinkPrice(
    festivalId: string,
    drinkType: DrinkType,
    tentId?: string,
  ): Promise<GetDrinkPriceResponse> {
    // Use the database function for efficiency
    const { data, error } = await this.supabase.rpc("get_drink_price_cents", {
      p_festival_id: festivalId,
      p_tent_id: tentId,
      p_drink_type: drinkType,
    });

    if (error || data === null) {
      // Fallback to system default
      return {
        priceCents: DEFAULT_DRINK_PRICES[drinkType] || 1620,
        source: "default",
      };
    }

    // Determine source by checking what exists
    let source: PriceSource = "default";

    if (tentId) {
      // Check if tent has override
      const { data: tentPrice } = await this.supabase
        .from("drink_type_prices")
        .select("id")
        .eq("drink_type", drinkType)
        .not("festival_tent_id", "is", null)
        .limit(1);

      if (tentPrice && tentPrice.length > 0) {
        source = "tent";
      } else {
        // Check if festival has price
        const { data: festivalPrice } = await this.supabase
          .from("drink_type_prices")
          .select("id")
          .eq("festival_id", festivalId)
          .eq("drink_type", drinkType)
          .limit(1);

        source =
          festivalPrice && festivalPrice.length > 0 ? "festival" : "default";
      }
    } else {
      // No tent, check festival
      const { data: festivalPrice } = await this.supabase
        .from("drink_type_prices")
        .select("id")
        .eq("festival_id", festivalId)
        .eq("drink_type", drinkType)
        .limit(1);

      source =
        festivalPrice && festivalPrice.length > 0 ? "festival" : "default";
    }

    return {
      priceCents: data,
      source,
    };
  }

  /**
   * Get all drink prices for a festival (defaults only, not tent overrides)
   */
  async getFestivalPrices(
    festivalId: string,
  ): Promise<Record<DrinkType, number>> {
    const { data, error } = await this.supabase
      .from("drink_type_prices")
      .select("drink_type, price_cents")
      .eq("festival_id", festivalId);

    // Start with system defaults
    const prices: Record<string, number> = { ...DEFAULT_DRINK_PRICES };

    if (!error && data) {
      for (const row of data) {
        prices[row.drink_type] = row.price_cents;
      }
    }

    return prices as Record<DrinkType, number>;
  }

  /**
   * Get tent-specific price overrides (only returns prices that differ from festival default)
   */
  async getTentPrices(
    festivalId: string,
    tentId: string,
  ): Promise<Partial<Record<DrinkType, number>>> {
    // First get the festival_tent_id
    const { data: festivalTent } = await this.supabase
      .from("festival_tents")
      .select("id")
      .eq("festival_id", festivalId)
      .eq("tent_id", tentId)
      .single();

    if (!festivalTent) {
      return {};
    }

    const { data, error } = await this.supabase
      .from("drink_type_prices")
      .select("drink_type, price_cents")
      .eq("festival_tent_id", festivalTent.id);

    if (error || !data) {
      return {};
    }

    const prices: Partial<Record<DrinkType, number>> = {};
    for (const row of data) {
      prices[row.drink_type as DrinkType] = row.price_cents;
    }

    return prices;
  }
}
