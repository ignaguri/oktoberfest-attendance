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
import { addDays } from "date-fns";
import { isSameDay } from "date-fns/isSameDay";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

import type { Tables } from "@/lib/database.types";
import type { SupabaseClient } from "@/lib/types";
import type { User } from "@supabase/supabase-js";

import { NO_ROWS_ERROR, TIMEZONE } from "./constants";
import { createNotificationService } from "./services/notifications";

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
  festivalId?: string,
  date?: Date,
  single: boolean = false,
): Promise<Tables<"attendances"> | Tables<"attendances">[] | null> {
  const supabase = createClient();
  const query = supabase.from("attendances").select("*").eq("user_id", userId);

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
  return data;
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

  const supabase = createClient();
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
  const supabase = createClient();
  const user = await getUser();
  const { amount, date, tents, festivalId } = formData;

  const dateWithTime = new TZDate(date, TIMEZONE);
  const now = new TZDate(new Date(), TIMEZONE);
  dateWithTime.setHours(
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );

  const { data: attendanceData, error } = await supabase.rpc(
    "add_or_update_attendance_with_tents_v3",
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
  revalidateTag("leaderboard");
  revalidateTag("attendances");

  revalidatePath("/attendance");
  revalidatePath("/home");

  return attendanceId;
}

/**
 * Add personal attendance without triggering group notifications
 * Used for My attendances page where users manage their own data
 * This function replaces all tent visits for the date (not append-only like addAttendance)
 */
export async function addPersonalAttendance(formData: {
  amount: number;
  date: Date;
  tents: string[];
  festivalId: string;
}) {
  const supabase = createClient();
  const user = await getUser();

  // Use shared function for attendance record upsert
  const { data: attendanceId, error: attendanceError } = await supabase.rpc(
    "upsert_attendance_record",
    {
      p_user_id: user.id,
      p_date: formatTimestampForDatabase(formData.date),
      p_beer_count: formData.amount,
      p_festival_id: formData.festivalId,
    },
  );

  if (attendanceError) {
    reportSupabaseException("addPersonalAttendance", attendanceError, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error adding attendance: " + attendanceError.message);
  }

  // attendanceId is returned directly from the RPC function

  // Replace tent visits for this date (delete existing, then insert new)
  // First, delete existing tent visits for this date (using cast to date for comparison)
  const { error: deleteError } = await supabase
    .from("tent_visits")
    .delete()
    .eq("user_id", user.id)
    .eq("festival_id", formData.festivalId)
    .gte("visit_date", formatTimestampForDatabase(formData.date))
    .lt("visit_date", formatTimestampForDatabase(addDays(formData.date, 1)));

  if (deleteError) {
    reportSupabaseException("addPersonalAttendance", deleteError, {
      id: user.id,
      email: user.email,
    });
    throw new Error(
      "Error clearing existing tent visits: " + deleteError.message,
    );
  }

  // Add new tent visits if tents were provided
  if (formData.tents.length > 0) {
    const tentVisits = formData.tents.map((tentId) => ({
      id: uuidv4(),
      user_id: user.id,
      festival_id: formData.festivalId,
      tent_id: tentId,
      visit_date: formatTimestampForDatabase(formData.date),
    }));

    const { error: tentVisitError } = await supabase
      .from("tent_visits")
      .insert(tentVisits);

    if (tentVisitError) {
      reportSupabaseException("addPersonalAttendance", tentVisitError, {
        id: user.id,
        email: user.email,
      });
      throw new Error("Error adding tent visits: " + tentVisitError.message);
    }
  }

  // Invalidate cache tags for leaderboard since attendance affects rankings
  revalidateTag("leaderboard");
  revalidateTag("attendances");

  revalidatePath("/attendance");
  revalidatePath("/home");

  return attendanceId;
}

// Cache winning criteria for 4 hours since they rarely change
const getCachedWinningCriterias = unstable_cache(
  async (supabaseClient: SupabaseClient) => {
    const { data, error } = await supabaseClient
      .from("winning_criteria")
      .select("*");
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
  const supabase = createClient();
  return getCachedWinningCriterias(supabase);
}

// Cache all tents for 2 hours since they rarely change
const getCachedTents = unstable_cache(
  async (supabaseClient: SupabaseClient) => {
    const { data, error } = await supabaseClient.from("tents").select("*");
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
  async (festivalId: string, supabaseClient: SupabaseClient) => {
    const { data, error } = await supabaseClient
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

    // Transform to match original tents structure for backward compatibility
    return (data || []).map((item: { tent: Tables<"tents"> }) => item.tent);
  },
  ["festival-tents"],
  { revalidate: 3600, tags: ["tents", "festival-tents"] }, // 1 hour cache
);

export async function fetchTents(festivalId?: string) {
  const supabase = createClient();

  if (festivalId) {
    // Return festival-specific tents
    return getCachedFestivalTents(festivalId, supabase);
  } else {
    // Return all tents (backward compatibility)
    return getCachedTents(supabase);
  }
}

// Tutorial completion functions
// Cache tutorial status for 5 minutes since it changes infrequently
const getCachedTutorialStatus = unstable_cache(
  async (userId: string, supabaseClient: SupabaseClient) => {
    const { data, error } = await supabaseClient
      .from("profiles")
      .select("tutorial_completed, tutorial_completed_at")
      .eq("id", userId)
      .single();

    if (error) {
      reportSupabaseException("getTutorialStatus", error, {
        id: userId,
      });
      throw new Error("Error fetching tutorial status");
    }

    return {
      tutorial_completed: data?.tutorial_completed || false,
      tutorial_completed_at: data?.tutorial_completed_at || null,
    };
  },
  ["user-tutorial-status"],
  { revalidate: 300, tags: ["user-profile", "tutorial-status"] }, // 5 minutes cache
);

export async function getTutorialStatus() {
  const user = await getUser();
  const supabase = createClient();
  return getCachedTutorialStatus(user.id, supabase);
}

export async function completeTutorial() {
  const user = await getUser();
  const supabase = createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      tutorial_completed: true,
      tutorial_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    reportSupabaseException("completeTutorial", error, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error completing tutorial");
  }

  // Invalidate tutorial-related caches
  revalidateTag("user-profile");
  revalidateTag("tutorial-status");
  revalidatePath("/profile");
  revalidatePath("/home");

  return { success: true };
}

export async function resetTutorial() {
  const user = await getUser();
  const supabase = createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      tutorial_completed: false,
      tutorial_completed_at: null,
    })
    .eq("id", user.id);

  if (error) {
    reportSupabaseException("resetTutorial", error, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error resetting tutorial");
  }

  // Invalidate tutorial-related caches
  revalidateTag("user-profile");
  revalidateTag("tutorial-status");
  revalidatePath("/profile");
  revalidatePath("/home");

  return { success: true };
}
