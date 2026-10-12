import type { SupabaseClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";

import { logger } from "../../lib/logger";
import { createLiveActivityPushService } from "./live-activity-push.service";

/**
 * Refreshes the user's lock-screen counters after a write, without delaying
 * the response. Never throws.
 */
export function scheduleLiveActivityRefresh(supabase: SupabaseClient, userId: string): void {
  const work = Promise.resolve()
    .then(() => createLiveActivityPushService(supabase).notifyUserChanged(userId))
    .catch((error: unknown) => {
      logger.error(
        { userId, error: error instanceof Error ? error.message : String(error) },
        "Live activity refresh failed",
      );
    });
  waitUntil(work);
}
