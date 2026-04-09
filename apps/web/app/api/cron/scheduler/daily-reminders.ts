import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationService } from "@/lib/services/notifications";

function getDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export async function processDailyReminderNotifications(
  supabase: SupabaseClient<Database>,
  notifications: NotificationService,
) {
  const { data: eligibleUsers } = await supabase
    .from("user_notification_preferences")
    .select("user_id")
    .eq("push_enabled", true)
    .eq("daily_reminder_enabled", true)
    .limit(500);

  if (!Array.isArray(eligibleUsers) || eligibleUsers.length === 0) {
    return;
  }

  const dayOfYear = getDayOfYear();

  await Promise.allSettled(
    eligibleUsers
      .filter((user) => user.user_id != null)
      .map((user) =>
        notifications.notifyDailyReminder(user.user_id!, { dayOfYear }),
      ),
  );
}
