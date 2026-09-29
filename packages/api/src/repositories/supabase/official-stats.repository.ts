import type { Database } from "@prostcounter/db";
import {
  type AdminFestivalOfficialStats,
  type UpdateAdminFestivalOfficialStatsInput,
  type WrappedOfficialStats,
  CuriousFindSchema,
  WrappedOfficialStatsSchema,
} from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { DatabaseError } from "../../middleware/error";

type OfficialStatsRow = Database["public"]["Tables"]["festival_official_stats"]["Row"];

const FindsSchema = z.array(CuriousFindSchema);

function toAdmin(row: OfficialStatsRow): AdminFestivalOfficialStats {
  return {
    festivalId: row.festival_id,
    visitors: row.visitors,
    massServed: row.mass_served,
    mugsConfiscated: row.mugs_confiscated,
    lostItems: row.lost_items,
    curiousFinds: FindsSchema.parse(row.curious_finds),
    sourceUrl: row.source_url,
    updatedAt: row.updated_at,
  };
}

/**
 * The city's final numbers for a festival (festival_official_stats). Wrapped
 * reads them next to the cached data, so entering them later invalidates nothing.
 */
export class SupabaseOfficialStatsRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  /** This festival's stats, or the latest earlier festival's of the same series. */
  async getForWrapped(festivalId: string): Promise<WrappedOfficialStats | null> {
    const { data, error } = await this.supabase.rpc("get_festival_official_stats", {
      p_festival_id: festivalId,
    });

    if (error) {
      throw new DatabaseError(`Failed to fetch official stats: ${error.message}`);
    }

    const row = data?.[0];
    if (!row) {
      return null;
    }

    return WrappedOfficialStatsSchema.parse({
      year: row.stats_year,
      isCurrentFestival: row.source_festival_id === festivalId,
      visitors: row.visitors,
      massServed: row.mass_served,
      mugsConfiscated: row.mugs_confiscated,
      lostItems: row.lost_items,
      curiousFinds: row.curious_finds,
      sourceUrl: row.source_url,
    });
  }

  async getForAdmin(festivalId: string): Promise<AdminFestivalOfficialStats | null> {
    const { data, error } = await this.supabase
      .from("festival_official_stats")
      .select("*")
      .eq("festival_id", festivalId)
      .maybeSingle();

    if (error) {
      throw new DatabaseError(`Failed to fetch official stats: ${error.message}`);
    }

    return data ? toAdmin(data) : null;
  }

  async upsert(
    festivalId: string,
    input: UpdateAdminFestivalOfficialStatsInput,
  ): Promise<AdminFestivalOfficialStats> {
    const { data, error } = await this.supabase
      .from("festival_official_stats")
      .upsert(
        {
          festival_id: festivalId,
          visitors: input.visitors,
          mass_served: input.massServed,
          mugs_confiscated: input.mugsConfiscated,
          lost_items: input.lostItems,
          curious_finds: input.curiousFinds,
          source_url: input.sourceUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "festival_id" },
      )
      .select("*")
      .single();

    if (error || !data) {
      throw new DatabaseError(`Failed to save official stats: ${error?.message}`);
    }

    return toAdmin(data);
  }
}
