import type { Database } from "@prostcounter/db";
import { formatDateForDatabase } from "@prostcounter/shared/utils";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import type { NotificationService } from "@/lib/services/notifications";

const USERS_PAGE_SIZE = 1000;

async function listConfirmedUserIds(supabase: SupabaseClient<Database>): Promise<string[] | null> {
  const confirmedUserIds: string[] = [];

  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: USERS_PAGE_SIZE });
    if (error) {
      logger.error(
        "Failed to list users for festival opening push",
        logger.apiRoute("cron/scheduler"),
        error,
      );
      return null;
    }
    const users = data?.users ?? [];
    for (const user of users) {
      if (user.email_confirmed_at) {
        confirmedUserIds.push(user.id);
      }
    }
    if (users.length < USERS_PAGE_SIZE) {
      return confirmedUserIds;
    }
  }
}

/**
 * Sends the opening-day push for every festival whose start_date is today in
 * its own timezone. Runs from the daily scheduler (09:00 UTC on Vercel Hobby,
 * so it lands between 11:00 and 11:59 in Munich, before the noon tapping).
 */
export async function processFestivalOpeningNotifications(
  supabase: SupabaseClient<Database>,
  notifications: NotificationService,
  now: Date,
) {
  const { data: festivals, error: festivalsError } = await supabase
    .from("festivals")
    .select("id, name, start_date, timezone");

  if (festivalsError) {
    logger.error(
      "Failed to load festivals for opening push",
      logger.apiRoute("cron/scheduler"),
      festivalsError,
    );
    return;
  }

  const openingToday = (festivals ?? []).filter(
    (festival) => festival.start_date === formatDateForDatabase(now, festival.timezone),
  );

  if (openingToday.length === 0) {
    return;
  }

  const confirmedUserIds = await listConfirmedUserIds(supabase);
  if (!confirmedUserIds) {
    return;
  }

  // Preferences can't be read: skip rather than notify people who opted out.
  const { data: optedOutRows, error: preferencesError } = await supabase
    .from("user_notification_preferences")
    .select("user_id")
    .eq("reminders_enabled", false);

  if (preferencesError) {
    logger.error(
      "Failed to load reminder preferences for opening push",
      logger.apiRoute("cron/scheduler"),
      preferencesError,
    );
    return;
  }

  const optedOutUserIds = new Set((optedOutRows ?? []).map((row) => row.user_id));
  const recipientIds = confirmedUserIds.filter((userId) => !optedOutUserIds.has(userId));

  for (const festival of openingToday) {
    await notifications.notifyFestivalOpening(recipientIds, {
      id: festival.id,
      name: festival.name,
    });
  }
}
