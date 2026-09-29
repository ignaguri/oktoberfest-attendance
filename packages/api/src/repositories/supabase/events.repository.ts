import type { Database, Json } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { PreparedEvent } from "../../services/event-ingest";
import { createAdminClient } from "../../utils/admin-client";

/**
 * Writes usage events through analytics_record_events, which is executable by
 * service_role only (see the analytics_events migration), hence the
 * service-role client. user_id always comes from the caller's token.
 */
export class SupabaseEventsRepository {
  constructor(private readonly client: SupabaseClient<Database> = createAdminClient()) {}

  async record(
    userId: string,
    events: PreparedEvent[],
    platform?: string,
    appVersion?: string,
  ): Promise<number> {
    const { data, error } = await this.client.rpc("analytics_record_events", {
      p_user_id: userId,
      p_events: events as unknown as Json,
      ...(platform ? { p_platform: platform } : {}),
      ...(appVersion ? { p_app_version: appVersion } : {}),
    });
    if (error) {
      throw new Error(`analytics_record_events failed: ${error.message}`);
    }
    return data ?? 0;
  }
}
