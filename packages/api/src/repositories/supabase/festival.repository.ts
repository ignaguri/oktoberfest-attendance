import type { Database } from "@prostcounter/db";
import type { Festival, FestivalDrinkPrices, ListFestivalsQuery } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { PgErrorCode } from "../../lib/postgres-errors";
import { DatabaseError } from "../../middleware/error";
import type { IFestivalRepository } from "../interfaces";

/**
 * Festival columns plus the festival's drink price sheet.
 *
 * The embed resolves through drink_type_prices.festival_id, and a tent-scoped
 * row has that column null (the table allows exactly one parent), so this
 * returns festival-level prices only, which is what a client should predict
 * with.
 */
const FESTIVAL_SELECT = "*, drink_type_prices(drink_type, price_cents)";

export class SupabaseFestivalRepository implements IFestivalRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async list(query?: ListFestivalsQuery): Promise<Festival[]> {
    let supabaseQuery = this.supabase.from("festivals").select(FESTIVAL_SELECT);

    if (query?.status) {
      supabaseQuery = supabaseQuery.eq("status", query.status);
    }

    if (query?.isActive !== undefined) {
      supabaseQuery = supabaseQuery.eq("is_active", query.isActive);
    }

    supabaseQuery = supabaseQuery.order("start_date", { ascending: false });

    const { data, error } = await supabaseQuery;

    if (error) {
      throw new DatabaseError(`Failed to list festivals: ${error.message}`);
    }

    return data.map((item) => this.mapToFestival(item));
  }

  async findById(id: string): Promise<Festival | null> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select(FESTIVAL_SELECT)
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === PgErrorCode.NO_ROWS) {
        return null; // Not found
      }
      throw new DatabaseError(`Failed to fetch festival: ${error.message}`);
    }

    return this.mapToFestival(data);
  }

  async findActive(): Promise<Festival | null> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select(FESTIVAL_SELECT)
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === PgErrorCode.NO_ROWS) {
        return null; // No active festival
      }
      throw new DatabaseError(`Failed to fetch active festival: ${error.message}`);
    }

    return this.mapToFestival(data);
  }

  private mapToFestival(data: any): Festival {
    return {
      id: data.id,
      name: data.name,
      startDate: data.start_date,
      endDate: data.end_date,
      beerCost: data.beer_cost,
      drinkPrices: mapDrinkPrices(data.drink_type_prices),
      location: data.location,
      latitude: data.latitude,
      longitude: data.longitude,
      mapUrl: data.map_url,
      isActive: data.is_active,
      status: data.status,
      timezone: data.timezone,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}

/**
 * Folds the embedded price rows into a lookup keyed by drink type.
 *
 * An empty sheet is a normal answer, not a failure: a festival that has never
 * been priced falls back to the system defaults on both sides.
 */
function mapDrinkPrices(rows: unknown): FestivalDrinkPrices {
  if (!Array.isArray(rows)) {
    return {};
  }

  const prices: FestivalDrinkPrices = {};
  for (const row of rows) {
    if (row?.drink_type && typeof row.price_cents === "number") {
      prices[row.drink_type as keyof FestivalDrinkPrices] = row.price_cents;
    }
  }
  return prices;
}
