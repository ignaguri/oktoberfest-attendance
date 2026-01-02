"use server";

import { getUser } from "@/lib/sharedActions";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath, revalidateTag } from "next/cache";

// Reservation server actions
// NOTE: These should eventually be migrated to Hono API endpoints

export async function createReservation(input: {
  festivalId: string;
  tentId: string;
  startAt: Date;
  endAt?: Date | null;
  reminderOffsetMinutes?: number;
  visibleToGroups?: boolean;
  note?: string | null;
}) {
  const supabase = await createClient();
  const user = await getUser();

  const { error } = await supabase.from("reservations").insert({
    user_id: user.id,
    festival_id: input.festivalId,
    tent_id: input.tentId,
    start_at: input.startAt.toISOString(),
    end_at: input.endAt ? input.endAt.toISOString() : null,
    reminder_offset_minutes: input.reminderOffsetMinutes ?? 1440,
    visible_to_groups: input.visibleToGroups ?? true,
    note: input.note ?? null,
  });

  if (error) throw new Error(error.message);
  revalidateTag("reservations", "max");
  revalidateTag(`calendar-${user.id}-${input.festivalId}`, "max");
  revalidateTag("tent_visits", "max");
  revalidatePath("/calendar");
}

export async function cancelReservation(reservationId: string) {
  const supabase = await createClient();
  const user = await getUser();

  const { error } = await supabase
    .from("reservations")
    .update({ status: "canceled" })
    .eq("id", reservationId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateTag("reservations", "max");
  revalidateTag("tent_visits", "max");
  revalidatePath("/calendar");
}

export async function updateReservation(
  reservationId: string,
  updates: Partial<{
    startAt: Date;
    endAt: Date | null;
    reminderOffsetMinutes: number;
    visibleToGroups: boolean;
    note: string | null;
    tentId: string;
  }>,
) {
  const supabase = await createClient();
  const user = await getUser();

  const payload: Record<string, unknown> = {};
  if (updates.startAt) payload.start_at = updates.startAt.toISOString();
  if (updates.endAt !== undefined)
    payload.end_at = updates.endAt ? updates.endAt.toISOString() : null;
  if (updates.reminderOffsetMinutes !== undefined)
    payload.reminder_offset_minutes = updates.reminderOffsetMinutes;
  if (updates.visibleToGroups !== undefined)
    payload.visible_to_groups = updates.visibleToGroups;
  if (updates.note !== undefined) payload.note = updates.note;
  if (updates.tentId) payload.tent_id = updates.tentId;

  const { error } = await supabase
    .from("reservations")
    .update(payload)
    .eq("id", reservationId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateTag("reservations", "max");
  revalidateTag("tent_visits", "max");
  revalidatePath("/calendar");
}

export async function getReservationForEdit(reservationId: string) {
  const supabase = await createClient();
  const user = await getUser();

  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, festival_id, tent_id, start_at, end_at, reminder_offset_minutes, visible_to_groups, note",
    )
    .eq("id", reservationId)
    .eq("user_id", user.id)
    .single();

  if (error) throw new Error(error.message);

  return data;
}

export async function getReservationForCheckIn(reservationId: string) {
  const supabase = await createClient();
  const user = await getUser();

  const { data, error } = await supabase
    .from("reservations")
    .select(
      `
      id,
      start_at,
      visible_to_groups,
      note,
      tent:tents(name)
    `,
    )
    .eq("id", reservationId)
    .eq("user_id", user.id)
    .eq("status", "scheduled")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
