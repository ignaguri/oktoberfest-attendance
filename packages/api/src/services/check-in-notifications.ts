import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../lib/logger";
import { createNotificationService } from "./notification.service";

/**
 * One push per check-in.
 *
 * The ledger claim inside notifyDayStart decides which: winning it means this
 * is the day's first action, so friends and group-mates get a day-start;
 * losing it means the day is already underway, so group-mates get the ordinary
 * tent check-in. Never both.
 *
 * Checks for a notification service before doing anything else: every caller sits on a
 * write path the offline sync queue can hammer, so a Novu-less environment
 * (local dev, most test runs) should not pay for the group-membership and
 * tent-name lookups just to throw the result away.
 *
 * Never throws — a notification failure must not fail the attendance write.
 */
export async function announceCheckIn(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    festivalId: string;
    date: string;
    tentIds: string[];
  },
): Promise<void> {
  const notificationService = createNotificationService(supabase);
  if (!notificationService) {
    return;
  }

  try {
    const groupIds = await groupIdsForFestival(supabase, input.userId, input.festivalId);
    const tentNames = await tentNamesFor(supabase, input.tentIds);

    const startedDay = await notificationService.notifyDayStart({
      actorId: input.userId,
      festivalId: input.festivalId,
      date: input.date,
      kind: "checkin",
      tentName: tentNames || null,
    });

    if (startedDay) {
      return;
    }

    if (groupIds.length > 0) {
      await notificationService.notifyTentCheckin(
        input.userId,
        tentNames,
        groupIds,
        input.festivalId,
      );
    }
  } catch (notificationError) {
    logger.error({ error: notificationError }, "Failed to send check-in notification");
  }
}

/** The caller's group ids for a festival. Empty on any failure. */
async function groupIdsForFestival(
  supabase: SupabaseClient<Database>,
  userId: string,
  festivalId: string,
): Promise<string[]> {
  const { data: memberships, error } = await supabase
    .from("group_members")
    .select("group_id, groups!inner(festival_id)")
    .eq("user_id", userId)
    .eq("groups.festival_id", festivalId);

  if (error || !memberships) {
    return [];
  }

  return memberships
    .map((membership) => membership.group_id)
    .filter((id): id is string => id !== null);
}

/**
 * Tent names for ids, comma-joined.
 *
 * Falls back to "Multiple tents" when more than one id was asked for but the
 * join produced no usable names — this was the fallback for every multi-tent
 * POST /attendance push before the check-in notification path was widened to
 * share this helper across endpoints; losing it silently changed existing
 * push copy. Falls back to "a tent" when there is genuinely nothing to name:
 * no ids at all, or a single id whose name couldn't be resolved.
 */
export async function tentNamesFor(
  supabase: SupabaseClient<Database>,
  tentIds: string[],
): Promise<string> {
  if (tentIds.length === 0) {
    return "a tent";
  }

  const fallback = tentIds.length > 1 ? "Multiple tents" : "a tent";

  const { data: tents } = await supabase.from("tents").select("id, name").in("id", tentIds);

  return (
    tents
      ?.map((tent) => tent.name)
      .filter((name) => name)
      .join(", ") || fallback
  );
}
