"use server";

import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { getCacheKeys, deleteCache, clearAllCaches } from "@/lib/cache";
import { Tables } from "@/lib/database.types";

import "server-only";

export async function getUsers() {
  const supabase = createClient(true);
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error("Error fetching users: " + error.message);

  // Fetch corresponding profile data
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("*");
  if (profileError)
    throw new Error("Error fetching profiles: " + profileError.message);

  // Combine auth and profile data
  const combinedUsers = users.users.map((user) => ({
    ...user,
    profile: profiles.find((profile) => profile.id === user.id),
  }));

  return combinedUsers;
}

export async function updateUserAuth(
  userId: string,
  userData: { email?: string; password?: string },
) {
  const supabase = createClient(true);
  const { data, error } = await supabase.auth.admin.updateUserById(
    userId,
    userData,
  );
  if (error) throw new Error("Error updating user auth: " + error.message);
  revalidatePath("/admin");
  return data;
}

export async function updateUserProfile(
  userId: string,
  profileData: Partial<Tables<"profiles">>,
) {
  const supabase = createClient(true);
  const { data, error } = await supabase
    .from("profiles")
    .update(profileData)
    .eq("id", userId)
    .single();

  if (error) throw new Error("Error updating user profile: " + error.message);
  revalidatePath("/admin");
  return data;
}

export async function deleteUser(userId: string) {
  const supabase = createClient(true);
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw new Error("Error deleting user: " + error.message);
  revalidatePath("/admin");
}

export async function getGroups() {
  const supabase = createClient(true);
  const { data: groups, error } = await supabase.from("groups").select("*");
  if (error) throw new Error("Error fetching groups: " + error.message);
  return groups;
}

export async function updateGroup(
  groupId: string,
  groupData: Partial<Tables<"groups">>,
) {
  const supabase = createClient(true);
  const { data, error } = await supabase
    .from("groups")
    .update(groupData)
    .eq("id", groupId)
    .single();

  if (error) throw new Error("Error updating group: " + error.message);
  revalidatePath("/admin");
  return data;
}

export async function deleteGroup(groupId: string) {
  const supabase = createClient(true);
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw new Error("Error deleting group: " + error.message);
  revalidatePath("/admin");
}

export async function getUserAttendances(userId: string) {
  const supabase = createClient(true);
  const { data: attendances, error } = await supabase
    .from("attendances")
    .select("*")
    .eq("user_id", userId);

  if (error) throw new Error("Error fetching attendances: " + error.message);

  // Fetch tent visits for each attendance
  const attendancesWithTents = await Promise.all(
    attendances.map(async (attendance) => {
      const tentVisits = await getTentVisitsForAttendance(
        userId,
        new Date(attendance.date),
      );
      return {
        ...attendance,
        tent_ids: tentVisits.map((visit) => visit.tent_id), // Extract tent IDs
      };
    }),
  );

  return attendancesWithTents;
}

export async function updateAttendance(
  attendanceId: string,
  attendanceData: Partial<Tables<"attendances">> & { tent_ids?: string[] },
) {
  const supabase = createClient(true);

  const { tent_ids, ...attendanceDataWithoutTentIds } = attendanceData;
  // Update the attendance record
  const { data, error } = await supabase
    .from("attendances")
    .update(attendanceDataWithoutTentIds)
    .eq("id", attendanceId)
    .single();

  if (error) throw new Error("Error updating attendance: " + error.message);

  // Update the tent visits
  if (tent_ids && attendanceData.user_id && attendanceData.date) {
    // First, delete existing tent visits for the user and date
    await supabase
      .from("tent_visits")
      .delete()
      .eq("user_id", attendanceData.user_id)
      .eq("visit_date", attendanceData.date);

    // Insert new tent visits
    const tentVisits = tent_ids.map((tentId) => ({
      id: uuidv4(),
      user_id: attendanceData.user_id!,
      tent_id: tentId,
      visit_date: attendanceData.date!,
    }));

    const { error: tentVisitError } = await supabase
      .from("tent_visits")
      .insert(tentVisits);

    if (tentVisitError) {
      throw new Error("Error adding tent visits: " + tentVisitError.message);
    }
  }

  revalidatePath("/admin");
  return data;
}

export async function deleteAttendance(attendanceId: string) {
  const supabase = createClient(true);
  const { error } = await supabase
    .from("attendances")
    .delete()
    .eq("id", attendanceId);
  if (error) throw new Error("Error deleting attendance: " + error.message);
  revalidatePath("/admin");
}

export async function getTentVisitsForAttendance(userId: string, date: Date) {
  const supabase = createClient(true);
  const { data: tentVisits, error } = await supabase
    .from("tent_visits")
    .select("tent_id")
    .eq("user_id", userId)
    .eq("visit_date", date.toISOString().split("T")[0]); // Use the date for filtering

  if (error) throw new Error("Error fetching tent visits: " + error.message);
  return tentVisits;
}

export async function listCacheKeys() {
  return getCacheKeys(); // Return the list of cache keys
}

export async function deleteCacheKey(key: string) {
  deleteCache(key); // Delete the specified cache key
  revalidatePath("/admin"); // Revalidate the admin page
}

export async function deleteAllCaches() {
  clearAllCaches(); // Clear all caches
  revalidatePath("/admin"); // Revalidate the admin page
}
