import type { Database } from "@prostcounter/db";
import type { DrinkType } from "@prostcounter/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

type AdminClient = SupabaseClient<Database>;

export async function insertAttendance(
  admin: AdminClient,
  userId: string,
  festivalId: string,
  date: string,
): Promise<string> {
  const { data, error } = await admin
    .from("attendances")
    .insert({ user_id: userId, festival_id: festivalId, date })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create attendance: ${error?.message ?? "no data"}`);
  }

  return data.id;
}

export async function insertConsumption(
  admin: AdminClient,
  attendanceId: string,
  drinkType: DrinkType,
): Promise<string> {
  const { data, error } = await admin
    .from("consumptions")
    .insert({
      attendance_id: attendanceId,
      drink_type: drinkType,
      base_price_cents: 1620,
      price_paid_cents: 1620,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create consumption: ${error?.message ?? "no data"}`);
  }

  return data.id;
}

export async function insertTentVisit(
  admin: AdminClient,
  visit: { userId: string; festivalId: string; tentId: string; visitDate: string },
): Promise<void> {
  const { error } = await admin.from("tent_visits").insert({
    id: randomUUID(),
    user_id: visit.userId,
    festival_id: visit.festivalId,
    tent_id: visit.tentId,
    visit_date: visit.visitDate,
  });

  if (error) {
    throw new Error(`Failed to create tent visit: ${error.message}`);
  }
}

export async function insertPhoto(
  admin: AdminClient,
  photo: {
    userId: string;
    attendanceId: string;
    visibility: "public" | "private";
    createdAt?: string;
  },
): Promise<string> {
  const { data, error } = await admin
    .from("beer_pictures")
    .insert({
      user_id: photo.userId,
      attendance_id: photo.attendanceId,
      picture_url: `integration-test/${randomUUID()}.jpg`,
      visibility: photo.visibility,
      ...(photo.createdAt ? { created_at: photo.createdAt } : {}),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create photo: ${error?.message ?? "no data"}`);
  }

  return data.id;
}

/**
 * Removes everything attendance-shaped for these festivals. Must run before
 * `cleanupDayPlanFixtures`, which deletes the festivals: attendances_festival_id_fkey
 * is RESTRICT and beer_pictures.attendance_id does not cascade.
 */
export async function cleanupAttendanceFixtures(
  admin: AdminClient,
  festivalIds: string[],
): Promise<void> {
  if (festivalIds.length === 0) {
    return;
  }

  const { data } = await admin.from("attendances").select("id").in("festival_id", festivalIds);
  const attendanceIds = (data ?? []).map((row) => row.id);

  await admin.from("tent_visits").delete().in("festival_id", festivalIds);

  if (attendanceIds.length > 0) {
    await admin.from("beer_pictures").delete().in("attendance_id", attendanceIds);
    await admin.from("consumptions").delete().in("attendance_id", attendanceIds);
  }

  await admin.from("attendances").delete().in("festival_id", festivalIds);
}
