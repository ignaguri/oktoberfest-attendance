import type { NotificationService } from "@/lib/services/notifications";
import type { Database } from "@prostcounter/db";
import type { SupabaseClient } from "@supabase/supabase-js";

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
    const { data: tents } = await supabase
      .from("tents")
      .select("id, name")
      .in("id", tentIds);
    const tentIdToName = new Map<string, string>(
      (tents || []).map((t) => [t.id, t.name]),
    );

    await Promise.allSettled(
      dueReminders.map((r) =>
        notifications.notifyReservationReminder(r.user_id, {
          reservationId: r.id,
          tentName: tentIdToName.get(r.tent_id) || "",
          startAtISO: r.start_at,
        }),
      ),
    );

    await supabase
      .from("reservations")
      .update({ reminder_sent_at: new Date().toISOString() })
      .in(
        "id",
        dueReminders.map((r) => r.id),
      );
  }

  const { data: duePrompts, error: promptsError } = await supabase.rpc(
    "rpc_due_reservation_prompts",
    { p_now: nowIso },
  );

  if (!promptsError && Array.isArray(duePrompts) && duePrompts.length) {
    const tentIds: string[] = Array.from(
      new Set(duePrompts.map((r) => r.tent_id).filter(Boolean) as string[]),
    );
    const { data: tents } = await supabase
      .from("tents")
      .select("id, name")
      .in("id", tentIds);
    const tentIdToName = new Map<string, string>(
      (tents || []).map((t) => [t.id, t.name]),
    );

    await Promise.allSettled(
      duePrompts.map((r) =>
        notifications.notifyReservationPrompt(r.user_id, {
          reservationId: r.id,
          tentName: tentIdToName.get(r.tent_id) || "",
          deepLinkUrl: `${baseUrl}/attendance?reservationId=${r.id}&prompt=checkin`,
        }),
      ),
    );

    await supabase
      .from("reservations")
      .update({ prompt_sent_at: new Date().toISOString() })
      .in(
        "id",
        duePrompts.map((r) => r.id),
      );
  }
}
