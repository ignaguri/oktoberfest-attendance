import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotificationService } from "@/lib/services/notifications";

/**
 * Rows whose notification actually went out.
 *
 * The notification service catches its own errors, so a settled promise says
 * nothing about delivery. Stamping a row that never sent would mark it done
 * forever: the rpc only returns rows with a null sent_at, so the next run skips
 * it. Leaving it unstamped is what lets the retry happen.
 */
function deliveredIds<T extends { id: string }>(
  rows: T[],
  results: PromiseSettledResult<boolean>[],
): string[] {
  return rows
    .filter((_, index) => {
      const result = results[index];
      return result.status === "fulfilled" && result.value;
    })
    .map((row) => row.id);
}

export async function processReservationNotifications(
  supabase: SupabaseClient<Database>,
  notifications: NotificationService,
  baseUrl: string,
  nowIso: string,
) {
  const { data: dueReminders, error: remindersError } = await supabase.rpc(
    "rpc_due_reservation_reminders",
    { p_now: nowIso },
  );

  if (!remindersError && Array.isArray(dueReminders) && dueReminders.length) {
    const tentIds: string[] = Array.from(
      new Set(dueReminders.map((r) => r.tent_id).filter(Boolean) as string[]),
    );
    const { data: tents } = await supabase.from("tents").select("id, name").in("id", tentIds);
    const tentIdToName = new Map<string, string>((tents || []).map((t) => [t.id, t.name]));

    const results = await Promise.allSettled(
      dueReminders.map((r) =>
        notifications.notifyReservationReminder(r.user_id, {
          reservationId: r.id,
          tentName: tentIdToName.get(r.tent_id) || "",
          startAtISO: r.start_at,
        }),
      ),
    );

    const sentIds = deliveredIds(dueReminders, results);

    if (sentIds.length) {
      await supabase
        .from("day_plans")
        .update({ reminder_sent_at: new Date().toISOString() })
        .in("id", sentIds);
    }
  }

  const { data: duePrompts, error: promptsError } = await supabase.rpc(
    "rpc_due_reservation_prompts",
    { p_now: nowIso },
  );

  if (!promptsError && Array.isArray(duePrompts) && duePrompts.length) {
    const tentIds: string[] = Array.from(
      new Set(duePrompts.map((r) => r.tent_id).filter(Boolean) as string[]),
    );
    const { data: tents } = await supabase.from("tents").select("id, name").in("id", tentIds);
    const tentIdToName = new Map<string, string>((tents || []).map((t) => [t.id, t.name]));

    const results = await Promise.allSettled(
      duePrompts.map((r) =>
        notifications.notifyReservationPrompt(r.user_id, {
          reservationId: r.id,
          tentName: tentIdToName.get(r.tent_id) || "",
          deepLinkUrl: `${baseUrl}/attendance?reservationId=${r.id}&prompt=checkin`,
        }),
      ),
    );

    const sentIds = deliveredIds(duePrompts, results);

    if (sentIds.length) {
      await supabase
        .from("day_plans")
        .update({ prompt_sent_at: new Date().toISOString() })
        .in("id", sentIds);
    }
  }
}
