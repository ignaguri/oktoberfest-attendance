"use server";

import { fetchAttendancesFromDB, getUser } from "@/lib/sharedActions";
import { TIMEZONE } from "@/lib/constants";
import { createClient } from "@/utils/supabase/server";
import { TZDate } from "@date-fns/tz";
import { isSameDay } from "date-fns";
import { revalidatePath } from "next/cache";

import "server-only";

export async function fetchAttendances() {
  const user = await getUser();

  const attendanceData = await fetchAttendancesFromDB(user.id);

  if (!attendanceData) {
    return null;
  }

  const supabase = createClient();
  const { data: tentVisits, error: tentVisitsError } = await supabase
    .from("tent_visits")
    .select("tent_id, visit_date, tents(name)")
    .eq("user_id", user.id);

  if (tentVisitsError) {
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
    throw new Error("Error deleting attendance: " + error.message);
  }

  revalidatePath("/attendance");
  revalidatePath("/home");
}
