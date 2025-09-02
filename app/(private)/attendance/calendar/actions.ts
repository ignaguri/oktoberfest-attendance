"use server";

import { getUser } from "@/lib/sharedActions";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

export async function getPersonalCalendarEvents(festivalId: string) {
  const user = await getUser();
  const db = createClient();

  const getCached = unstable_cache(
    async (uId: string, festId: string) => {
      const { data, error } = await db
        .from("attendances")
        .select("id, date, beer_count")
        .eq("festival_id", festId)
        .eq("user_id", uId);

      if (error) {
        throw new Error(error.message);
      }

      const attendanceEvents = (data ?? []).map(
        (a: { id: string; date: string; beer_count: number }) => ({
          id: a.id,
          title: `${a.beer_count} Maß`,
          from: new Date(a.date),
          type: "attendance" as const,
        }),
      );

      // Reservations for the user in this festival (scheduled ones)
      const { data: reservations, error: resErr } = await db
        .from("reservations")
        .select("id, start_at, end_at, status, tent:tents(id, name)")
        .eq("festival_id", festId)
        .eq("user_id", uId)
        .eq("status", "scheduled");

      if (resErr) {
        throw new Error(resErr.message);
      }

      const reservationEvents = (reservations ?? []).map(
        (r: {
          id: string;
          start_at: string;
          end_at: string | null;
          status: string;
          tent: { id: string; name: string } | null;
        }) => ({
          id: r.id,
          title: `Reservation${r.tent?.name ? ` · ${r.tent.name}` : ""}`,
          from: new Date(r.start_at),
          to: r.end_at ? new Date(r.end_at) : null,
          type: "reservation" as const,
        }),
      );

      return [...attendanceEvents, ...reservationEvents];
    },
    ["personal-calendar"],
    {
      revalidate: 300,
      tags: ["calendar", `calendar-${user.id}-${festivalId}`, "attendances"],
    },
  );

  return getCached(user.id, festivalId);
}

export async function createReservation(input: {
  festivalId: string;
  tentId: string;
  startAt: Date;
  endAt?: Date | null;
  reminderOffsetMinutes?: number;
  visibleToGroups?: boolean;
  note?: string | null;
}) {
  const supabase = createClient();
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
  revalidateTag("reservations");
  revalidateTag(`calendar-${user.id}-${input.festivalId}`);
  revalidatePath("/attendance/calendar");
}

export async function cancelReservation(reservationId: string) {
  const supabase = createClient();
  const user = await getUser();

  const { error } = await supabase
    .from("reservations")
    .update({ status: "canceled" })
    .eq("id", reservationId)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidateTag("reservations");
  revalidatePath("/attendance/calendar");
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
  const supabase = createClient();
  const user = await getUser();

  const payload: Record<string, any> = {};
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
  revalidateTag("reservations");
  revalidatePath("/attendance/calendar");
}

export async function getReservationForEdit(reservationId: string) {
  const supabase = createClient();
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
  const supabase = createClient();
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
