"use server";

import { TIMEZONE } from "@/lib/constants";
import { createClient } from "@/utils/supabase/server";
import { TZDate } from "@date-fns/tz";
import { isSameDay } from "date-fns";
import { unstable_cache } from "next/cache";

import type { CalendarEventType } from "@/lib/types";

export async function getGroupCalendarEvents(
  groupId: string,
  festivalId: string,
) {
  const db = await createClient();

  const getCached = unstable_cache(
    async (festId: string, grpId: string) => {
      // Get group member user IDs
      const { data: members, error: membersError } = await db
        .from("group_members")
        .select("user_id")
        .eq("group_id", grpId);

      if (membersError) {
        throw new Error(membersError.message);
      }

      const memberIds = (members ?? [])
        .map((m) => m.user_id)
        .filter((id): id is string => Boolean(id));
      if (memberIds.length === 0) return [] as any[];

      // Get profiles for pretty names
      const { data: profiles } = await db
        .from("profiles")
        .select("id, username, full_name")
        .in("id", memberIds);

      const idToName = new Map<string, string>();
      (profiles ?? []).forEach((p) =>
        idToName.set(p.id, p.username ?? p.full_name ?? "Member"),
      );

      // Get attendances for those members in this festival
      // Use attendance_with_totals view for consistent beer_count from consumptions
      const { data: attendances, error: attError } = await (db.from as any)(
        "attendance_with_totals",
      )
        .select("id, date, beer_count, user_id")
        .eq("festival_id", festId)
        .in("user_id", memberIds);

      if (attError) {
        throw new Error(attError.message);
      }

      // Get tent visits for those members in this festival
      const { data: tentVisits, error: tentVisitsError } = await db
        .from("tent_visits")
        .select("tent_id, visit_date, user_id, tents(name)")
        .eq("festival_id", festId)
        .in("user_id", memberIds);

      if (tentVisitsError) {
        throw new Error(tentVisitsError.message);
      }

      // Create individual events for each tent visit
      const tentVisitEvents = (tentVisits ?? [])
        .filter((tv) => tv.visit_date) // Filter out null visit dates
        .map((tv) => {
          const tentName = tv.tents?.name || "Unknown Tent";
          const memberName = idToName.get(tv.user_id ?? "") ?? "Member";

          return {
            id: `tent-visit-${tv.tent_id}-${tv.visit_date}-${tv.user_id}`,
            title: `${memberName}: ${tentName}`,
            from: new TZDate(tv.visit_date!, TIMEZONE),
            type: "tent_visit" as CalendarEventType,
          };
        });

      // Create beer summary events for days with tent visits
      const beerSummaryEvents = (attendances ?? [])
        .map(
          (a: {
            id: string;
            date: string;
            beer_count: number | string; // View returns bigint as string
            user_id: string | null;
          }) => {
            // Check if this attendance has any tent visits
            const hasTentVisits = (tentVisits ?? []).some(
              (tv) =>
                tv.visit_date &&
                tv.user_id === a.user_id &&
                isSameDay(
                  new TZDate(tv.visit_date, TIMEZONE),
                  new TZDate(a.date, TIMEZONE),
                ),
            );

            // Convert beer_count to number since view returns bigint as string
            const beerCount = Number(a.beer_count) || 0;

            // Only create a beer summary if there are tent visits for this date
            if (!hasTentVisits || beerCount === 0) {
              return null;
            }

            const memberName = idToName.get(a.user_id ?? "") ?? "Member";

            return {
              id: `beer-summary-${a.id}`,
              title: `${memberName}: ${beerCount} Maß`,
              from: new TZDate(a.date, TIMEZONE),
              type: "beer_summary" as CalendarEventType,
            };
          },
        )
        .filter(Boolean) as {
        id: string;
        title: string;
        from: TZDate;
        type: CalendarEventType;
      }[];

      // Create fallback events for attendances without tent visits
      const attendanceEvents = (attendances ?? [])
        .map(
          (a: {
            id: string;
            date: string;
            beer_count: number | string; // View returns bigint as string
            user_id: string | null;
          }) => {
            // Check if this attendance has any tent visits
            const hasTentVisits = (tentVisits ?? []).some(
              (tv) =>
                tv.visit_date &&
                tv.user_id === a.user_id &&
                isSameDay(
                  new TZDate(tv.visit_date, TIMEZONE),
                  new TZDate(a.date, TIMEZONE),
                ),
            );

            // Only create a fallback event if there are no tent visits for this date
            if (hasTentVisits) {
              return null;
            }

            const memberName = idToName.get(a.user_id ?? "") ?? "Member";
            // Convert beer_count to number since view returns bigint as string
            const beerCount = Number(a.beer_count) || 0;

            return {
              id: a.id,
              title: `${memberName}: ${beerCount} Maß`,
              from: new TZDate(a.date, TIMEZONE),
              type: "attendance" as CalendarEventType,
            };
          },
        )
        .filter(Boolean) as {
        id: string;
        title: string;
        from: TZDate;
        type: CalendarEventType;
      }[];

      // Group-visible reservations for those members
      const { data: reservations, error: resErr } = await db
        .from("reservations")
        .select(
          "id, user_id, start_at, end_at, status, visible_to_groups, tent:tents(id, name)",
        )
        .eq("festival_id", festId)
        .eq("visible_to_groups", true)
        .in("user_id", memberIds);

      if (resErr) {
        throw new Error(resErr.message);
      }

      const reservationEvents = (reservations ?? []).map(
        (r: {
          id: string;
          user_id: string | null;
          start_at: string;
          end_at: string | null;
          status: string;
          visible_to_groups: boolean;
          tent: { id: string; name: string } | null;
        }) => ({
          id: r.id,
          title: `${idToName.get(r.user_id ?? "") ?? "Member"}: Reservation${
            r.tent?.name ? ` · ${r.tent.name}` : ""
          }`,
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
    ["group-calendar"],
    {
      revalidate: 300,
      tags: [
        "calendar",
        `calendar-group-${groupId}`,
        "attendances",
        "tent_visits",
      ],
    },
  );

  return getCached(festivalId, groupId);
}

export async function getGroupCalendarData(groupId: string) {
  const db = await createClient();

  // Get the group's festival_id and festival data
  const { data: groupData, error: groupError } = await db
    .from("groups")
    .select("festival_id, festivals(start_date, end_date)")
    .eq("id", groupId)
    .single();

  if (groupError) {
    throw new Error(`Error fetching group info: ${groupError.message}`);
  }

  const events = await getGroupCalendarEvents(groupId, groupData.festival_id);
  const initialMonth = groupData.festivals?.start_date
    ? new Date(groupData.festivals.start_date)
    : new Date();

  const festivalStartDate = groupData.festivals?.start_date
    ? new Date(groupData.festivals.start_date)
    : undefined;

  const festivalEndDate = groupData.festivals?.end_date
    ? new Date(groupData.festivals.end_date)
    : undefined;

  return {
    events,
    initialMonth,
    festivalId: groupData.festival_id,
    festivalStartDate,
    festivalEndDate,
  };
}
