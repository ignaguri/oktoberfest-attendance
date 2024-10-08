"use server";

import { reportLog, reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { TZDate } from "@date-fns/tz";
import * as Sentry from "@sentry/nextjs";
import { isSameDay } from "date-fns/isSameDay";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

import type { Tables } from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";

import { NO_ROWS_ERROR, TIMEZONE } from "./constants";

import "server-only";

export async function getUser(): Promise<User> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not found");
  }

  Sentry.setUser({ email: user.email, id: user.id }); // Set the user in Sentry
  return user;
}

export async function getProfileShort() {
  const user = await getUser();

  const supabase = createClient();
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, username, avatar_url, custom_beer_cost")
    .eq("id", user.id)
    .single();

  if (!profileData || profileError) {
    reportSupabaseException("getProfileShort", profileError, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error fetching profile");
  }
  return { ...profileData, email: user.email };
}

export async function getProfileShortFailsafe() {
  try {
    return await getProfileShort();
  } catch {
    return null;
  }
}

export async function fetchAttendancesFromDB(
  userId: string,
  date?: Date,
  single: boolean = false,
): Promise<Tables<"attendances"> | Tables<"attendances">[] | null> {
  const supabase = createClient();
  const query = supabase.from("attendances").select("*").eq("user_id", userId);
  if (date) {
    query.eq("date", date.toISOString().split("T")[0]);
  }
  query.order("date", { ascending: true });
  const { data, error } = await (single ? query.single() : query);
  if (error) {
    if (error.code === NO_ROWS_ERROR) {
      return null;
    }
    reportSupabaseException("fetchAttendancesFromDB", error, { id: userId });
    throw new Error(`Error fetching attendances: ${error.message}`);
  }
  return data;
}

export type AttendanceByDate = Tables<"attendances"> & {
  tent_ids: string[];
  picture_urls: string[];
};
export async function fetchAttendanceByDate(
  date: Date,
): Promise<AttendanceByDate | null> {
  const user = await getUser();

  const zonedDate = new TZDate(date, TIMEZONE);
  const attendanceData = await fetchAttendancesFromDB(user.id, zonedDate, true);

  const supabase = createClient();
  const { data: tentVisits, error: tentVisitsError } = await supabase
    .from("tent_visits")
    .select("tent_id, visit_date")
    .eq("user_id", user.id);

  if (tentVisitsError) {
    reportSupabaseException("fetchAttendanceByDate", tentVisitsError, {
      id: user.id,
      email: user.email,
    });
    throw new Error(`Error fetching tent visits: ${tentVisitsError.message}`);
  }

  // Filter tent visits for the given date as the visit_date is a timestamptz in the db
  // and casting visit_date::date didn't work
  const tentVisitsForDate = tentVisits.filter(
    (tentVisit) =>
      tentVisit.visit_date &&
      isSameDay(
        new TZDate(tentVisit.visit_date, TIMEZONE),
        new TZDate(date, TIMEZONE),
      ),
  );

  const attendance = Array.isArray(attendanceData)
    ? attendanceData[0]
    : attendanceData;

  if (!attendance) {
    return null;
  }

  const { data: beerPictures, error: beerPicturesError } = await supabase
    .from("beer_pictures")
    .select("picture_url")
    .eq("user_id", user.id)
    .eq("attendance_id", attendance.id);

  if (beerPicturesError) {
    reportSupabaseException("fetchAttendanceByDate", beerPicturesError, {
      id: user.id,
      email: user.email,
    });
    throw new Error(
      `Error fetching beer pictures: ${beerPicturesError.message}`,
    );
  }

  const result = {
    ...attendance,
    tent_ids: tentVisitsForDate.map((visit) => visit.tent_id),
    picture_urls: beerPictures.map((pic) => pic.picture_url),
  };

  return result;
}

export async function uploadBeerPicture(formData: FormData) {
  const picture = formData.get("picture") as File;
  const attendanceId = formData.get("attendanceId") as string;
  const supabase = createClient();
  const user = await getUser();

  const buffer = await picture.arrayBuffer();

  let compressedBuffer;
  try {
    compressedBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: 1000, height: 1000, fit: "inside" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    const errorMessage = "Error compressing image: " + JSON.stringify(error);
    reportLog(errorMessage, "error");
    throw new Error(errorMessage);
  }

  const fileName = `${user.id}_${attendanceId}_${uuidv4()}.webp`;
  const { error } = await supabase.storage
    .from("beer_pictures")
    .upload(fileName, compressedBuffer, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    const errorMessage = "Error uploading beer picture: " + error.message;
    reportLog(errorMessage, "error");
    throw new Error(errorMessage);
  }

  const { error: beerPicturesError } = await supabase
    .from("beer_pictures")
    .insert({
      user_id: user.id,
      attendance_id: attendanceId,
      picture_url: fileName,
    });
  if (beerPicturesError) {
    reportSupabaseException("uploadBeerPicture", beerPicturesError, {
      id: user.id,
      email: user.email,
    });
    throw new Error(
      "Error saving beer picture in DB: " + beerPicturesError.message,
    );
  }

  return fileName;
}

export async function addAttendance(formData: {
  amount: number;
  date: Date;
  tents: string[];
}) {
  const supabase = createClient();
  const user = await getUser();
  const { amount, date, tents } = formData;

  const dateWithTime = new TZDate(date, TIMEZONE);
  const now = new TZDate(new Date(), TIMEZONE);
  dateWithTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);

  const { data: attendanceData, error } = await supabase.rpc(
    "add_or_update_attendance_with_tents",
    {
      p_user_id: user.id,
      p_date: dateWithTime.toISOString(),
      p_beer_count: amount,
      p_tent_ids: tents,
    },
  );

  if (error) {
    reportSupabaseException("addAttendance", error, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error adding/updating attendance: " + error.message);
  }

  const attendanceId = attendanceData as string;

  revalidatePath("/attendance");
  revalidatePath("/home");

  return attendanceId;
}

export async function fetchWinningCriterias() {
  const supabase = createClient();
  const { data, error } = await supabase.from("winning_criteria").select("*");
  if (error) {
    reportSupabaseException("fetchWinningCriterias", error);
    throw error;
  }

  return data;
}

export async function fetchTents() {
  const supabase = createClient();
  const { data, error } = await supabase.from("tents").select("*");
  if (error) {
    reportSupabaseException("fetchTents", error);
    throw new Error("Error fetching tents: " + error.message);
  }

  return data;
}
