import type { IFestivalRepository } from "../interfaces";
import type { Database } from "@prostcounter/db";
import type { Festival, ListFestivalsQuery } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";

export class SupabaseFestivalRepository implements IFestivalRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async list(query?: ListFestivalsQuery): Promise<Festival[]> {
    let supabaseQuery = this.supabase.from("festivals").select("*");

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
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new DatabaseError(`Failed to fetch festival: ${error.message}`);
    }

    return this.mapToFestival(data);
  }

  async findActive(): Promise<Festival | null> {
    const { data, error } = await this.supabase
      .from("festivals")
      .select("*")
      .eq("is_active", true)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // No active festival
      }
      throw new DatabaseError(
        `Failed to fetch active festival: ${error.message}`,
      );
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
      location: data.location,
      mapUrl: data.map_url,
      isActive: data.is_active,
      status: data.status,
      timezone: data.timezone,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
