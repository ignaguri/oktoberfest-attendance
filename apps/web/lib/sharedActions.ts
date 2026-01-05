"use server";

import {
  formatDateForDatabase,
  formatTimestampForDatabase,
} from "@/lib/date-utils";
import {
  reportLog,
  reportNotificationException,
  reportSupabaseException,
} from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { TZDate } from "@date-fns/tz";
import * as Sentry from "@sentry/nextjs";
import { isSameDay } from "date-fns/isSameDay";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

import type { Tables } from "@prostcounter/db";
import type { User } from "@supabase/supabase-js";

import { NO_ROWS_ERROR, TIMEZONE } from "./constants";
import { createNotificationService } from "./services/notifications";

import "server-only";

export async function getUser(): Promise<User> {
  const supabase = await createClient();
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

  const supabase = await createClient();
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, username, avatar_url, preferred_language")
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
  festivalId?: string,
  date?: Date,
  single: boolean = false,
): Promise<Tables<"attendances"> | Tables<"attendances">[] | null> {
  const supabase = await createClient();
  // Use attendance_with_totals view to get consistent beer_count calculated from consumptions
  // The view includes the same fields as attendances table plus computed totals
  const query = supabase
    .from("attendance_with_totals")
    .select("*")
    .eq("user_id", userId);

  if (festivalId) {
    query.eq("festival_id", festivalId);
  }
  if (date) {
    query.eq("date", formatDateForDatabase(date));
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
  return data as Tables<"attendances"> | Tables<"attendances">[] | null;
}

export type AttendanceByDate = Tables<"attendances"> & {
  tent_ids: string[];
  picture_urls: string[];
};
export async function fetchAttendanceByDate(
  date: Date,
  festivalId?: string,
): Promise<AttendanceByDate | null> {
  const user = await getUser();

  const zonedDate = new TZDate(date, TIMEZONE);
  const attendanceData = await fetchAttendancesFromDB(
    user.id,
    festivalId,
    zonedDate,
    true,
  );

  const supabase = await createClient();
  const tentVisitsQuery = supabase
    .from("tent_visits")
    .select("tent_id, visit_date")
    .eq("user_id", user.id);

  if (festivalId) {
    tentVisitsQuery.eq("festival_id", festivalId);
  }

  const { data: tentVisits, error: tentVisitsError } = await tentVisitsQuery;

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
  const visibility = (formData.get("visibility") as string) || "public";
  const supabase = await createClient();
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

  // Use the updated database function that supports visibility
  const { error: beerPicturesError } = await supabase.rpc("add_beer_picture", {
    p_user_id: user.id,
    p_attendance_id: attendanceId,
    p_picture_url: fileName,
    p_visibility: visibility as "public" | "private",
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
  festivalId: string;
}) {
  const supabase = await createClient();
  const user = await getUser();
  const { amount, date, tents, festivalId } = formData;

  // Validate that festivalId exists in the database
  const { data: festivalExists, error: festivalCheckError } = await supabase
    .from("festivals")
    .select("id")
    .eq("id", festivalId)
    .single();

  if (festivalCheckError || !festivalExists) {
    reportLog(`Invalid festivalId: ${festivalId}`, "error");
    throw new Error(
      `Invalid festival ID: ${festivalId}. Please refresh the page and try again.`,
    );
  }

  const dateWithTime = new TZDate(date, TIMEZONE);
  const now = new TZDate(new Date(), TIMEZONE);
  dateWithTime.setHours(
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );

  const { data: attendanceData, error } = await supabase.rpc(
    "add_or_update_attendance_with_tents",
    {
      p_user_id: user.id,
      p_beer_count: amount,
      p_tent_ids: tents,
      p_date: dateWithTime.toISOString(),
      p_festival_id: festivalId,
    },
  );

  if (error) {
    reportSupabaseException("addAttendance", error, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error adding/updating attendance: " + error.message);
  }

  const attendanceId = attendanceData?.[0]?.attendance_id;
  const tentsChanged = attendanceData?.[0]?.tents_changed;

  // Trigger tent check-in notifications only if tents were actually changed
  if (tents.length > 0 && tentsChanged) {
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
        .eq("groups.festival_id", festivalId);

      if (!groupError && groupMemberships && groupMemberships.length > 0) {
        // Get tent names for better notifications
        const { data: tentData } = await supabase
          .from("tents")
          .select("id, name")
          .in("id", tents);

        const tentNames =
          tentData
            ?.map((tent) => tent.name)
            .filter((name) => name)
            .join(", ") || "Multiple tents";
        const groupIds = groupMemberships
          .map((membership) => membership.group_id)
          .filter((id): id is string => id !== null);

        const notificationService = createNotificationService();
        await notificationService.notifyTentCheckin(
          user.id,
          tentNames,
          groupIds,
          festivalId,
        );
      }
    } catch (notificationError) {
      reportNotificationException("addAttendance", notificationError as Error, {
        id: user.id,
        email: user.email,
      });
      // Don't fail the attendance operation if notification fails
    }
  }

  // Invalidate cache tags for leaderboard since attendance affects rankings
  revalidateTag("leaderboard", "max");
  revalidateTag("attendances", "max");

  revalidatePath("/attendance");
  revalidatePath("/home");

  return attendanceId;
}

/**
 * Add personal attendance without triggering group notifications
 * Used for My attendances page where users manage their own data
 * This function preserves existing tent visit timestamps while allowing modifications
 */
export async function addPersonalAttendance(formData: {
  amount: number;
  date: Date;
  tents: string[];
  festivalId: string;
}) {
  const supabase = await createClient();
  const user = await getUser();

  // Use new function that preserves existing tent visit timestamps
  const { data: result, error: attendanceError } = await supabase.rpc(
    "update_personal_attendance_with_tents",
    {
      p_user_id: user.id,
      p_date: formatTimestampForDatabase(formData.date),
      p_beer_count: formData.amount,
      p_tent_ids: formData.tents.length > 0 ? formData.tents : [],
      p_festival_id: formData.festivalId,
    },
  );

  if (attendanceError) {
    reportSupabaseException("addPersonalAttendance", attendanceError, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error updating attendance: " + attendanceError.message);
  }

  const attendanceId = result?.[0]?.attendance_id;
  const tentsAdded = result?.[0]?.tents_added || [];
  const tentsRemoved = result?.[0]?.tents_removed || [];

  // Only trigger notifications if tents were actually changed
  if (tentsAdded.length > 0 || tentsRemoved.length > 0) {
    // Note: We could add notifications here if needed for personal attendance changes
    // For now, keeping it simple as personal attendance is private
  }

  // Invalidate cache tags for leaderboard since attendance affects rankings
  revalidateTag("leaderboard", "max");
  revalidateTag("attendances", "max");

  revalidatePath("/attendance");
  revalidatePath("/home");

  return attendanceId;
}

// Cache winning criteria for 4 hours since they rarely change
const getCachedWinningCriterias = unstable_cache(
  async () => {
    // Use service role client - this is public data, no user auth needed
    const supabase = await createClient(true);
    const { data, error } = await supabase.from("winning_criteria").select("*");
    if (error) {
      reportSupabaseException("fetchWinningCriterias", error);
      throw error;
    }

    return data;
  },
  ["winning-criteria"],
  { revalidate: 14400, tags: ["winning-criteria"] }, // 4 hours cache
);

export async function fetchWinningCriterias() {
  return getCachedWinningCriterias();
}

// Cache all tents for 2 hours since they rarely change
const getCachedTents = unstable_cache(
  async () => {
    // Use service role client - this is public data, no user auth needed
    const supabase = await createClient(true);
    const { data, error } = await supabase.from("tents").select("*");
    if (error) {
      reportSupabaseException("fetchTents", error);
      throw new Error("Error fetching tents: " + error.message);
    }

    return data;
  },
  ["tents"],
  { revalidate: 7200, tags: ["tents"] }, // 2 hours cache
);

// Cache festival-specific tents for 1 hour since they change more frequently
const getCachedFestivalTents = unstable_cache(
  async (festivalId: string) => {
    // Use service role client - this is public data, no user auth needed
    const supabase = await createClient(true);
    const { data, error } = await supabase
      .from("festival_tents")
      .select(
        `
        tent:tents!inner (
          id,
          name,
          category
        )
      `,
      )
      .eq("festival_id", festivalId)
      .order("tent.name", { ascending: true });

    if (error) {
      reportSupabaseException("fetchFestivalTents", error);
      throw new Error("Error fetching festival tents: " + error.message);
    }

    // If no festival-specific tents found, fall back to all tents
    // This ensures the app works even when festival_tents table is not populated
    if (!data || data.length === 0) {
      const { data: allTentsData, error: allTentsError } = await supabase
        .from("tents")
        .select("*")
        .order("name", { ascending: true });

      if (allTentsError) {
        reportSupabaseException("fetchAllTentsFallback", allTentsError);
        throw new Error(
          "Error fetching fallback tents: " + allTentsError.message,
        );
      }

      return allTentsData || [];
    }

    // Transform to match original tents structure for backward compatibility
    return (data || []).map((item: { tent: Tables<"tents"> }) => item.tent);
  },
  ["festival-tents"],
  { revalidate: 3600, tags: ["tents", "festival-tents"] }, // 1 hour cache
);

export async function fetchTents(festivalId?: string) {
  if (festivalId) {
    // Return festival-specific tents
    return getCachedFestivalTents(festivalId);
  } else {
    // Return all tents (backward compatibility)
    return getCachedTents();
  }
}

// Tutorial status function
// No caching - user-specific data, RLS must be enforced
export async function getTutorialStatus() {
  const user = await getUser();
  const supabase = await createClient(); // Use authenticated client for RLS

  const { data, error } = await supabase
    .from("profiles")
    .select("tutorial_completed, tutorial_completed_at")
    .eq("id", user.id)
    .single();

  if (error) {
    reportSupabaseException("getTutorialStatus", error, {
      id: user.id,
    });
    throw new Error("Error fetching tutorial status");
  }

  return {
    tutorial_completed: data?.tutorial_completed || false,
    tutorial_completed_at: data?.tutorial_completed_at || null,
  };
}
