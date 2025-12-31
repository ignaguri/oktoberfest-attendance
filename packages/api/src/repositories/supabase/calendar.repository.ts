import type { Database } from "@prostcounter/db";
import type { CalendarEvent, CalendarEventType } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

const TIMEZONE = "Europe/Berlin";

export class SupabaseCalendarRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async getPersonalCalendarEvents(
    userId: string,
    festivalId: string,
  ): Promise<{
    events: CalendarEvent[];
    festivalStartDate: string | null;
    festivalEndDate: string | null;
  }> {
    // Get festival dates
    const { data: festival } = await this.supabase
      .from("festivals")
      .select("start_date, end_date")
      .eq("id", festivalId)
      .single();

    // Get attendances using the view for consistent beer_count
    const { data: attendances, error: attError } = await (
      this.supabase.from as any
    )("attendance_with_totals")
      .select("id, date, beer_count")
      .eq("festival_id", festivalId)
      .eq("user_id", userId);

    if (attError) {
      throw new Error(attError.message);
    }

    // Get tent visits
    const { data: tentVisits, error: tentError } = await this.supabase
      .from("tent_visits")
      .select("tent_id, visit_date, tents(name)")
      .eq("user_id", userId)
      .eq("festival_id", festivalId);

    if (tentError) {
      throw new Error(tentError.message);
    }

    // Get reservations
    const { data: reservations, error: resError } = await this.supabase
      .from("reservations")
      .select("id, start_at, end_at, status, tent:tents(id, name)")
      .eq("festival_id", festivalId)
      .eq("user_id", userId)
      .eq("status", "scheduled");

    if (resError) {
      throw new Error(resError.message);
    }

    const events: CalendarEvent[] = [];

    // Create tent visit events
    (tentVisits ?? [])
      .filter((tv) => tv.visit_date)
      .forEach((tv) => {
        const tentName = (tv.tents as any)?.name || "Unknown Tent";
        events.push({
          id: `tent-visit-${tv.tent_id}-${tv.visit_date}`,
          title: tentName,
          from: tv.visit_date!,
          type: "tent_visit" as CalendarEventType,
        });
      });

    // Create attendance/beer summary events
    (attendances ?? []).forEach(
      (a: { id: string; date: string; beer_count: number | string }) => {
        const beerCount = Number(a.beer_count) || 0;
        const hasTentVisits = (tentVisits ?? []).some(
          (tv) =>
            tv.visit_date &&
            tv.visit_date.substring(0, 10) === a.date.substring(0, 10),
        );

        if (hasTentVisits && beerCount > 0) {
          events.push({
            id: `beer-summary-${a.id}`,
            title: `${beerCount} Maß`,
            from: a.date,
            type: "beer_summary" as CalendarEventType,
          });
        } else if (!hasTentVisits) {
          events.push({
            id: a.id,
            title: `${beerCount} Maß`,
            from: a.date,
            type: "attendance" as CalendarEventType,
          });
        }
      },
    );

    // Create reservation events
    (reservations ?? []).forEach((r) => {
      const tentName = (r.tent as any)?.name;
      events.push({
        id: r.id,
        title: `Reservation${tentName ? ` · ${tentName}` : ""}`,
        from: r.start_at,
        to: r.end_at,
        type: "reservation" as CalendarEventType,
      });
    });

    return {
      events,
      festivalStartDate: festival?.start_date ?? null,
      festivalEndDate: festival?.end_date ?? null,
    };
  }

  async getGroupCalendarEvents(groupId: string): Promise<{
    events: CalendarEvent[];
    festivalId: string;
    festivalStartDate: string | null;
    festivalEndDate: string | null;
  }> {
    // Get group with festival info
    const { data: groupData, error: groupError } = await this.supabase
      .from("groups")
      .select("festival_id, festivals(start_date, end_date)")
      .eq("id", groupId)
      .single();

    if (groupError || !groupData) {
      throw new Error(`Group not found: ${groupError?.message}`);
    }

    const festivalId = groupData.festival_id;

    // Get group members
    const { data: members, error: membersError } = await this.supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    if (membersError) {
      throw new Error(membersError.message);
    }

    const memberIds = (members ?? [])
      .map((m) => m.user_id)
      .filter((id): id is string => Boolean(id));

    if (memberIds.length === 0) {
      return {
        events: [],
        festivalId,
        festivalStartDate: (groupData.festivals as any)?.start_date ?? null,
        festivalEndDate: (groupData.festivals as any)?.end_date ?? null,
      };
    }

    // Get member profiles for names
    const { data: profiles } = await this.supabase
      .from("profiles")
      .select("id, username, full_name")
      .in("id", memberIds);

    const idToName = new Map<string, string>();
    (profiles ?? []).forEach((p) =>
      idToName.set(p.id, p.username ?? p.full_name ?? "Member"),
    );

    // Get attendances using the view
    const { data: attendances, error: attError } = await (
      this.supabase.from as any
    )("attendance_with_totals")
      .select("id, date, beer_count, user_id")
      .eq("festival_id", festivalId)
      .in("user_id", memberIds);

    if (attError) {
      throw new Error(attError.message);
    }

    // Get tent visits
    const { data: tentVisits, error: tentError } = await this.supabase
      .from("tent_visits")
      .select("tent_id, visit_date, user_id, tents(name)")
      .eq("festival_id", festivalId)
      .in("user_id", memberIds);

    if (tentError) {
      throw new Error(tentError.message);
    }

    // Get group-visible reservations
    const { data: reservations, error: resError } = await this.supabase
      .from("reservations")
      .select(
        "id, user_id, start_at, end_at, status, visible_to_groups, tent:tents(id, name)",
      )
      .eq("festival_id", festivalId)
      .eq("visible_to_groups", true)
      .in("user_id", memberIds);

    if (resError) {
      throw new Error(resError.message);
    }

    const events: CalendarEvent[] = [];

    // Create tent visit events
    (tentVisits ?? [])
      .filter((tv) => tv.visit_date)
      .forEach((tv) => {
        const tentName = (tv.tents as any)?.name || "Unknown Tent";
        const memberName = idToName.get(tv.user_id ?? "") ?? "Member";
        events.push({
          id: `tent-visit-${tv.tent_id}-${tv.visit_date}-${tv.user_id}`,
          title: `${memberName}: ${tentName}`,
          from: tv.visit_date!,
          type: "tent_visit" as CalendarEventType,
        });
      });

    // Create attendance/beer summary events
    (attendances ?? []).forEach(
      (a: {
        id: string;
        date: string;
        beer_count: number | string;
        user_id: string | null;
      }) => {
        const beerCount = Number(a.beer_count) || 0;
        const memberName = idToName.get(a.user_id ?? "") ?? "Member";
        const hasTentVisits = (tentVisits ?? []).some(
          (tv) =>
            tv.visit_date &&
            tv.user_id === a.user_id &&
            tv.visit_date.substring(0, 10) === a.date.substring(0, 10),
        );

        if (hasTentVisits && beerCount > 0) {
          events.push({
            id: `beer-summary-${a.id}`,
            title: `${memberName}: ${beerCount} Maß`,
            from: a.date,
            type: "beer_summary" as CalendarEventType,
          });
        } else if (!hasTentVisits) {
          events.push({
            id: a.id,
            title: `${memberName}: ${beerCount} Maß`,
            from: a.date,
            type: "attendance" as CalendarEventType,
          });
        }
      },
    );

    // Create reservation events
    (reservations ?? []).forEach((r) => {
      const memberName = idToName.get(r.user_id ?? "") ?? "Member";
      const tentName = (r.tent as any)?.name;
      events.push({
        id: r.id,
        title: `${memberName}: Reservation${tentName ? ` · ${tentName}` : ""}`,
        from: r.start_at,
        to: r.end_at,
        type: "reservation" as CalendarEventType,
      });
    });

    return {
      events,
      festivalId,
      festivalStartDate: (groupData.festivals as any)?.start_date ?? null,
      festivalEndDate: (groupData.festivals as any)?.end_date ?? null,
    };
  }
}
