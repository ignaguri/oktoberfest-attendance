"use server";

import { TIMEZONE } from "@/lib/constants";
import { getUser } from "@/lib/sharedActions";
import { createClient } from "@/utils/supabase/server";
import { TZDate } from "@date-fns/tz";
import { isSameDay } from "date-fns";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

import type { CalendarEventType } from "@/lib/types";

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

      // Fetch tent visits for the user in this festival
      const { data: tentVisits, error: tentVisitsError } = await db
        .from("tent_visits")
        .select("tent_id, visit_date, tents(name)")
        .eq("user_id", uId)
        .eq("festival_id", festId);

      if (tentVisitsError) {
        throw new Error(tentVisitsError.message);
      }

      // Create individual events for each tent visit
      const tentVisitEvents = (tentVisits ?? [])
        .filter((tv) => tv.visit_date) // Filter out null visit dates
        .map((tv) => {
          const tentName = tv.tents?.name || "Unknown Tent";

          return {
            id: `tent-visit-${tv.tent_id}-${tv.visit_date}`,
            title: tentName,
            from: new TZDate(tv.visit_date!, TIMEZONE),
            type: "tent_visit" as CalendarEventType,
          };
        });

      // Create fallback events for attendances without tent visits
      const attendanceEvents = (data ?? [])
        .map((a: { id: string; date: string; beer_count: number }) => {
          // Check if this attendance has any tent visits
          const hasTentVisits = (tentVisits ?? []).some(
            (tv) =>
              tv.visit_date &&
              isSameDay(
                new TZDate(tv.visit_date, TIMEZONE),
                new TZDate(a.date, TIMEZONE),
              ),
          );

          // Only create a fallback event if there are no tent visits for this date
          if (hasTentVisits) {
            return null;
          }

          return {
            id: a.id,
            title: `${a.beer_count} Maß`,
            from: new TZDate(a.date, TIMEZONE),
            type: "beer_summary" as CalendarEventType,
          };
        })
        .filter((event): event is NonNullable<typeof event> => event !== null);

      // Create beer summary events for days with tent visits
      const beerSummaryEvents = (data ?? [])
        .map((a: { id: string; date: string; beer_count: number }) => {
          // Check if this attendance has any tent visits
          const hasTentVisits = (tentVisits ?? []).some(
            (tv) =>
              tv.visit_date &&
              isSameDay(
                new TZDate(tv.visit_date, TIMEZONE),
                new TZDate(a.date, TIMEZONE),
              ),
          );

          // Only create a beer summary if there are tent visits for this date
          if (!hasTentVisits || a.beer_count === 0) {
            return null;
          }

          return {
            id: `beer-summary-${a.id}`,
            title: `${a.beer_count} Maß`,
            from: new TZDate(a.date, TIMEZONE),
            type: "beer_summary" as CalendarEventType,
          };
        })
        .filter((event): event is NonNullable<typeof event> => event !== null);

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
          from: new TZDate(r.start_at, TIMEZONE),
          to: r.end_at ? new TZDate(r.end_at, TIMEZONE) : null,
          type: "reservation" as CalendarEventType,
        }),
      );

      return [
        ...beerSummaryEvents,
        ...tentVisitEvents,
        ...attendanceEvents,
        ...reservationEvents,
      ];
    },
    [user.id, festivalId],
    {
      revalidate: 300,
      tags: [
        "calendar",
        `calendar-${user.id}-${festivalId}`,
        "attendances",
        "tent_visits",
      ],
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
  revalidateTag("tent_visits");
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
  revalidateTag("tent_visits");
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
  revalidateTag("tent_visits");
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
