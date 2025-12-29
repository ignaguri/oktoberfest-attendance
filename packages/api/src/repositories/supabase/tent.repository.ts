import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@prostcounter/db";
import type { FestivalTent, Tent } from "@prostcounter/shared";
import type { ITentRepository } from "../interfaces";
import { DatabaseError } from "../../middleware/error";

export class SupabaseTentRepository implements ITentRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async listByFestival(festivalId: string): Promise<FestivalTent[]> {
    const { data, error } = await this.supabase
      .from("festival_tents")
      .select(
        `
        festival_id,
        tent_id,
        beer_price,
        is_open,
        tents (
          id,
          name,
          description,
          capacity,
          website,
          created_at,
          updated_at
        )
      `
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
    tentId: string
  ): Promise<FestivalTent | null> {
    const { data, error } = await this.supabase
      .from("festival_tents")
      .select(
        `
        festival_id,
        tent_id,
        beer_price,
        is_open,
        tents (
          id,
          name,
          description,
          capacity,
          website,
          created_at,
          updated_at
        )
      `
      )
      .eq("festival_id", festivalId)
      .eq("tent_id", tentId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new DatabaseError(`Failed to fetch festival tent: ${error.message}`);
    }

    return this.mapToFestivalTent(data);
  }

  private mapToFestivalTent(data: any): FestivalTent {
    const tent = data.tents as any;
    return {
      festivalId: data.festival_id,
      tentId: data.tent_id,
      beerPrice: data.beer_price,
      isOpen: data.is_open,
      tent: {
        id: tent.id,
        name: tent.name,
        description: tent.description,
        capacity: tent.capacity,
        website: tent.website,
        createdAt: tent.created_at,
        updatedAt: tent.updated_at,
      },
    };
  }
}
