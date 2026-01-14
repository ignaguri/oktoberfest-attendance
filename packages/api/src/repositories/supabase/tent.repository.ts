import type { ITentRepository } from "../interfaces";
import type { Database } from "@prostcounter/db";
import type { FestivalTent } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";

export class SupabaseTentRepository implements ITentRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async listByFestival(festivalId?: string): Promise<FestivalTent[]> {
    // If no festivalId provided, return empty array
    if (!festivalId) {
      return [];
    }

    const { data, error } = await this.supabase
      .from("festival_tents")
      .select(
        `
        festival_id,
        tent_id,
        beer_price,
        tents (
          id,
          name,
          category
        )
      `,
      )
      .eq("festival_id", festivalId)
      .order("tents(name)", { ascending: true });

    if (error) {
      throw new DatabaseError(`Failed to list tents: ${error.message}`);
    }

    return data.map((item) => this.mapToFestivalTent(item));
  }

  async findFestivalTent(
    festivalId: string,
    tentId: string,
  ): Promise<FestivalTent | null> {
    const { data, error } = await this.supabase
      .from("festival_tents")
      .select(
        `
        festival_id,
        tent_id,
        beer_price,
        tents (
          id,
          name,
          category
        )
      `,
      )
      .eq("festival_id", festivalId)
      .eq("tent_id", tentId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new DatabaseError(
        `Failed to fetch festival tent: ${error.message}`,
      );
    }

    return this.mapToFestivalTent(data);
  }

  private mapToFestivalTent(data: any): FestivalTent {
    const tent = data.tents as any;
    return {
      festivalId: data.festival_id,
      tentId: data.tent_id,
      beerPrice: data.beer_price ? Number(data.beer_price) : null,
      tent: {
        id: tent.id,
        name: tent.name,
        category: tent.category,
      },
    };
  }
}
