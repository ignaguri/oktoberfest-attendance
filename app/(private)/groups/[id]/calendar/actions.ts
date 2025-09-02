"use server";

import { createClient } from "@/utils/supabase/server";
import { unstable_cache } from "next/cache";

export async function getGroupCalendarEvents(
  festivalId: string,
  groupId: string,
) {
  const db = createClient();

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
      const { data: attendances, error: attError } = await db
        .from("attendances")
        .select("id, date, beer_count, user_id")
        .eq("festival_id", festId)
        .in("user_id", memberIds);

      if (attError) {
        throw new Error(attError.message);
      }

      const attendanceEvents = (attendances ?? []).map(
        (a: {
          id: string;
          date: string;
          beer_count: number;
          user_id: string | null;
        }) => ({
          id: a.id,
          title: `${idToName.get(a.user_id ?? "") ?? "Member"}: ${a.beer_count} Maß`,
          from: new Date(a.date),
          type: "attendance" as const,
        }),
      );

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
          from: new Date(r.start_at),
          to: r.end_at ? new Date(r.end_at) : null,
          type: "reservation" as const,
        }),
      );

      return [...attendanceEvents, ...reservationEvents];
    },
    ["group-calendar"],
    {
      revalidate: 300,
      tags: [
        "calendar",
        `calendar-group-${groupId}-${festivalId}`,
        "attendances",
      ],
    },
  );

  return getCached(festivalId, groupId);
}
