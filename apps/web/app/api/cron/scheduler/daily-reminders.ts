import { TZDate } from "@date-fns/tz";
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDayOfYear } from "date-fns";

import type { NotificationService } from "@/lib/services/notifications";

const BATCH_SIZE = 500;

export async function processDailyReminderNotifications(
  supabase: SupabaseClient<Database>,
  notifications: NotificationService,
) {
  // Compute day-of-year in UTC so rotation is stable regardless of the
  // server's local timezone / DST state. The scheduler runs at a fixed UTC
  // hour, so UTC day-of-year is the right index.
  const dayOfYear = getDayOfYear(new TZDate(Date.now(), "UTC"));

  // Paginate the eligibility query so we never silently drop users beyond
  // an arbitrary limit as the base grows.
  for (let from = 0; ; from += BATCH_SIZE) {
    const to = from + BATCH_SIZE - 1;
    const { data: batch } = await supabase
      .from("user_notification_preferences")
      .select("user_id")
      .eq("push_enabled", true)
      .eq("daily_reminder_enabled", true)
      .order("user_id", { ascending: true })
      .range(from, to);

    if (!Array.isArray(batch) || batch.length === 0) return;

    await Promise.allSettled(
      batch
        .filter((user) => user.user_id != null)
        .map((user) =>
          notifications.notifyDailyReminder(user.user_id!, { dayOfYear }),
        ),
    );

    if (batch.length < BATCH_SIZE) return;
  }
}
