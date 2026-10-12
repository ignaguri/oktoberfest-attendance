import type { Database } from "@prostcounter/db";
import type { RegisterLiveActivityTokenInput } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

import { DatabaseError } from "../../middleware/error";
import type { LiveActivityTokenRecord, LiveActivityTokenStore } from "../interfaces";

type TokenRow = Database["public"]["Tables"]["live_activity_tokens"]["Row"];

function toRecord(row: TokenRow): LiveActivityTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform as LiveActivityTokenRecord["platform"],
    token: row.token,
    apnsEnvironment: row.apns_environment as LiveActivityTokenRecord["apnsEnvironment"],
    festivalId: row.festival_id,
    date: row.date,
  };
}

/** Runs as the caller: RLS limits every query to their own rows. */
export class SupabaseLiveActivityTokenRepository implements LiveActivityTokenStore {
  constructor(private supabase: SupabaseClient<Database>) {}

  async upsert(userId: string, input: RegisterLiveActivityTokenInput): Promise<void> {
    const { error } = await this.supabase.from("live_activity_tokens").upsert(
      {
        user_id: userId,
        platform: input.platform,
        token: input.token,
        apns_environment: input.apnsEnvironment,
        festival_id: input.festivalId,
        date: input.date,
      },
      { onConflict: "user_id,token" },
    );
    if (error) {
      throw new DatabaseError(`Failed to save live activity token: ${error.message}`);
    }
  }

  async deleteToken(userId: string, token: string): Promise<void> {
    const { error } = await this.supabase
      .from("live_activity_tokens")
      .delete()
      .eq("user_id", userId)
      .eq("token", token);
    if (error) {
      throw new DatabaseError(`Failed to delete live activity token: ${error.message}`);
    }
  }

  async listForUser(userId: string): Promise<LiveActivityTokenRecord[]> {
    const { data, error } = await this.supabase
      .from("live_activity_tokens")
      .select("*")
      .eq("user_id", userId);
    if (error) {
      throw new DatabaseError(`Failed to list live activity tokens: ${error.message}`);
    }
    return data.map(toRecord);
  }

  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const { error } = await this.supabase.from("live_activity_tokens").delete().in("id", ids);
    if (error) {
      throw new DatabaseError(`Failed to prune live activity tokens: ${error.message}`);
    }
  }
}
