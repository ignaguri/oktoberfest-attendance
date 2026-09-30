import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

// Supabase caps a single response at max_rows=1000, so opted-out preferences
// have to be paged.
const PREFERENCES_PAGE_SIZE = 1000;

/** Users who turned reminders off; null when the preferences can't be read. */
export async function listOptedOutUserIds(
  supabase: SupabaseClient<Database>,
  purpose: string,
): Promise<string[] | null> {
  const optedOutUserIds: string[] = [];

  for (let from = 0; ; from += PREFERENCES_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("user_notification_preferences")
      .select("user_id")
      .eq("reminders_enabled", false)
      .order("user_id")
      .range(from, from + PREFERENCES_PAGE_SIZE - 1);

    if (error) {
      logger.error(
        `Failed to load reminder preferences for ${purpose}`,
        logger.apiRoute("cron/scheduler"),
        error,
      );
      return null;
    }

    const rows = data ?? [];
    for (const row of rows) {
      if (row.user_id) {
        optedOutUserIds.push(row.user_id);
      }
    }
    if (rows.length < PREFERENCES_PAGE_SIZE) {
      return optedOutUserIds;
    }
  }
}
