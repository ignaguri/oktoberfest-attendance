"use server";

import { TIMEZONE } from "@/lib/constants";
import { createNotificationService } from "@/lib/services/notifications";
import { fetchAttendancesFromDB, getUser } from "@/lib/sharedActions";
import {
  reportNotificationException,
  reportSupabaseException,
} from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { TZDate } from "@date-fns/tz";
import { isSameDay, format } from "date-fns";
import { revalidatePath } from "next/cache";

import "server-only";

export async function fetchAttendances(festivalId: string) {
  const user = await getUser();

  const attendanceData = await fetchAttendancesFromDB(user.id, festivalId);

  if (!attendanceData) {
    return null;
  }

  const supabase = createClient();
  const { data: tentVisits, error: tentVisitsError } = await supabase
    .from("tent_visits")
    .select("tent_id, visit_date, tents(name)")
    .eq("user_id", user.id)
    .eq("festival_id", festivalId);

  if (tentVisitsError) {
    reportSupabaseException("fetchAttendances", tentVisitsError, {
      id: user.id,
      email: user.email,
    });
    throw new Error(`Error fetching tent visits: ${tentVisitsError.message}`);
  }

  const attendances = Array.isArray(attendanceData)
    ? attendanceData
    : [attendanceData];

  const attendancesWithTentVisits = attendances.map((attendance) => ({
    ...attendance,
    tentVisits: tentVisits
      .filter(
        (tentVisit) =>
          tentVisit.visit_date &&
          isSameDay(
            new TZDate(tentVisit.visit_date, TIMEZONE),
            new TZDate(attendance.date, TIMEZONE),
          ),
      )
      .map((tentVisit) => {
        const { tents, ...tentVisitWithoutTent } = tentVisit;
        return {
          ...tentVisitWithoutTent,
          tentName: tents?.name,
        };
      }),
  }));

  return attendancesWithTentVisits;
}

export async function deleteAttendance(attendanceId: string) {
  const supabase = createClient();

  const { error } = await supabase.rpc("delete_attendance", {
    p_attendance_id: attendanceId,
  });

  if (error) {
    reportSupabaseException("deleteAttendance", error);
    throw new Error("Error deleting attendance: " + error.message);
  }

  revalidatePath("/attendance");
  revalidatePath("/home");
}

export async function checkInFromReservation(reservationId: string) {
  const supabase = createClient();
  const user = await getUser();

  // Get the reservation details
  const { data: reservation, error: reservationError } = await supabase
    .from("reservations")
    .select(
      `
      id,
      festival_id,
      tent_id,
      start_at,
      tents(name)
    `,
    )
    .eq("id", reservationId)
    .eq("user_id", user.id)
    .eq("status", "scheduled")
    .single();

  if (reservationError || !reservation) {
    throw new Error("Reservation not found or already processed");
  }

  // Get festival timezone
  const { data: festival, error: festivalError } = await supabase
    .from("festivals")
    .select("timezone")
    .eq("id", reservation.festival_id)
    .single();

  if (festivalError || !festival) {
    throw new Error("Festival not found");
  }

  // Convert start_at to festival timezone date
  const startDate = new Date(reservation.start_at);
  const tzDate = new TZDate(startDate, festival.timezone);
  const festivalDate = format(tzDate, "yyyy-MM-dd");

  // Check if user already has attendance for this date
  const { data: existingAttendance, error: attendanceError } = await supabase
    .from("attendances")
    .select("id")
    .eq("user_id", user.id)
    .eq("festival_id", reservation.festival_id)
    .eq("date", festivalDate)
    .single();

  if (attendanceError && attendanceError.code !== "PGRST116") {
    // PGRST116 is "not found" error, which is expected if no attendance exists
    reportSupabaseException("checkInFromReservation", attendanceError, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error checking existing attendance");
  }

  // If no existing attendance, create one
  if (!existingAttendance) {
    const { error: insertError } = await supabase.from("attendances").insert({
      user_id: user.id,
      festival_id: reservation.festival_id,
      date: festivalDate,
      beer_count: 0, // Start with 0 beers
    });

    if (insertError) {
      reportSupabaseException("checkInFromReservation", insertError, {
        id: user.id,
        email: user.email,
      });
      throw new Error("Error creating attendance");
    }
  }

  // Add tent visit if not already present
  const { error: tentVisitError } = await supabase
    .from("tent_visits")
    .insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      festival_id: reservation.festival_id,
      tent_id: reservation.tent_id,
      visit_date: startDate.toISOString(),
    })
    .select()
    .single();

  if (tentVisitError && tentVisitError.code !== "23505") {
    // 23505 is unique constraint violation, which is expected if visit already exists
    reportSupabaseException("checkInFromReservation", tentVisitError, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error creating tent visit");
  }

  // Mark reservation as completed
  const { error: updateError } = await supabase
    .from("reservations")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .eq("user_id", user.id);

  if (updateError) {
    reportSupabaseException("checkInFromReservation", updateError, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error updating reservation status");
  }

  // Trigger tent check-in notifications
  try {
    // Get user's group memberships for this festival
    const { data: groupMemberships, error: groupError } = await supabase
      .from("group_members")
      .select(
        `
        group_id,
        groups!inner(festival_id)
      `,
      )
      .eq("user_id", user.id)
      .eq("groups.festival_id", reservation.festival_id);

    if (!groupError && groupMemberships && groupMemberships.length > 0) {
      const tentName = (reservation.tents as any)?.name || "Tent";
      const groupIds = groupMemberships
        .map((membership) => membership.group_id)
        .filter((id): id is string => id !== null);

      const notificationService = createNotificationService();
      await notificationService.notifyTentCheckin(
        user.id,
        tentName,
        groupIds,
        reservation.festival_id,
      );
    }
  } catch (notificationError) {
    reportNotificationException(
      "checkInFromReservation",
      notificationError as Error,
      {
        id: user.id,
        email: user.email,
      },
    );
    // Don't fail the check-in operation if notification fails
  }

  // Revalidate relevant paths
  revalidatePath("/attendance");
  revalidatePath("/attendance/calendar");
  revalidatePath("/home");
}
