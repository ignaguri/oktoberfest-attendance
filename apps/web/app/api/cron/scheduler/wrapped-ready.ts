import type { Database } from "@prostcounter/db";
import { formatDateForDatabase } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format, parseISO } from "date-fns";

import { logger } from "@/lib/logger";
import type { NotificationService } from "@/lib/services/notifications";

import { listOptedOutUserIds } from "./preferences";

// Supabase caps a single response at max_rows=1000
const ATTENDANCE_PAGE_SIZE = 1000;

function dayAfter(date: string): string {
  return format(addDays(parseISO(date), 1), "yyyy-MM-dd");
}

/** Everyone with at least one attendance at the festival; null when it can't be read. */
async function listAttendeeIds(
  supabase: SupabaseClient<Database>,
  festivalId: string,
): Promise<string[] | null> {
  const attendeeIds = new Set<string>();

  for (let from = 0; ; from += ATTENDANCE_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("attendances")
      .select("user_id")
      .eq("festival_id", festivalId)
      .order("id")
      .range(from, from + ATTENDANCE_PAGE_SIZE - 1);

    if (error) {
      logger.error(
        "Failed to load attendees for Wrapped ready push",
        logger.apiRoute("cron/scheduler", { festivalId }),
        error,
      );
      return null;
    }

    const rows = data ?? [];
    for (const row of rows) {
      if (row.user_id) {
        attendeeIds.add(row.user_id);
      }
    }
    if (rows.length < ATTENDANCE_PAGE_SIZE) {
      return [...attendeeIds];
    }
  }
}

/**
 * Sends the "your Wrapped is ready" push for every festival whose Wrapped
 * unlocked today (00:00 on end_date + 1 in its own timezone). Runs from the
 * daily scheduler, so it lands late morning in Munich rather than at midnight.
 */
export async function processWrappedReadyNotifications(
  supabase: SupabaseClient<Database>,
  notifications: NotificationService,
  now: Date,
) {
  const { data: festivals, error: festivalsError } = await supabase
    .from("festivals")
    .select("id, name, end_date, timezone");

  if (festivalsError) {
    logger.error(
      "Failed to load festivals for Wrapped ready push",
      logger.apiRoute("cron/scheduler"),
      festivalsError,
    );
    return;
  }

  const unlockedToday = (festivals ?? []).filter(
    (festival) => dayAfter(festival.end_date) === formatDateForDatabase(now, festival.timezone),
  );

  if (unlockedToday.length === 0) {
    return;
  }

  // Preferences can't be read: skip rather than notify people who opted out.
  const optedOutUserIds = await listOptedOutUserIds(supabase, "Wrapped ready push");
  if (!optedOutUserIds) {
    return;
  }
  const optedOutUserIdSet = new Set(optedOutUserIds);

  for (const festival of unlockedToday) {
    const attendeeIds = await listAttendeeIds(supabase, festival.id);
    if (!attendeeIds) {
      continue;
    }
    const recipientIds = attendeeIds.filter((userId) => !optedOutUserIdSet.has(userId));
    if (recipientIds.length === 0) {
      continue;
    }
    await notifications.notifyWrappedReady(recipientIds, { id: festival.id, name: festival.name });
  }
}
