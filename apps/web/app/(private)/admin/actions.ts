"use server";

import { formatTimestampForDatabase } from "@/lib/date-utils";
import { sanitizeSearchTerm, logAdminAction } from "@/lib/utils/security";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath, unstable_cache } from "next/cache";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

import type { Tables } from "@prostcounter/db";

import "server-only";

// Cached version of getUsers for better performance
const getCachedUsers = unstable_cache(
  async (search: string | undefined, page: number, limit: number) => {
    // Use service role client - admin function needs full access
    const supabase = await createClient(true);

    // If searching, use a more efficient approach with proper pagination
    if (search) {
      // First, get all users from auth to search by email
      const { data: allUsers, error: usersError } =
        await supabase.auth.admin.listUsers();
      if (usersError) {
        throw new Error("Error fetching users: " + usersError.message);
      }

      // Filter users by email match
      const emailMatchingUsers = allUsers.users.filter((user) =>
        user.email?.toLowerCase().includes(search.toLowerCase()),
      );

      // Get profile IDs for email matches
      const emailMatchingUserIds = emailMatchingUsers.map((user) => user.id);

      // Search profiles table for name/username matches
      // Sanitize search term to prevent SQL injection
      const sanitizedSearch = sanitizeSearchTerm(search, 100);
      const searchPattern = `%${sanitizedSearch}%`;

      // Use separate queries and combine results to avoid SQL injection
      // This is safer than string interpolation in .or() filters
      const [nameResults, usernameResults] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, username")
          .ilike("full_name", searchPattern),
        supabase
          .from("profiles")
          .select("id, full_name, username")
          .ilike("username", searchPattern),
      ]);

      if (nameResults.error) {
        throw new Error(
          "Error fetching profiles: " + nameResults.error.message,
        );
      }
      if (usernameResults.error) {
        throw new Error(
          "Error fetching profiles: " + usernameResults.error.message,
        );
      }

      // Combine and deduplicate results
      const allProfiles = [
        ...(nameResults.data || []),
        ...(usernameResults.data || []),
      ];
      const uniqueProfiles = Array.from(
        new Map(allProfiles.map((p) => [p.id, p])).values(),
      );

      const profileCount = uniqueProfiles.length;
      const profiles = uniqueProfiles;

      // Get profile IDs for name/username matches
      const profileMatchingUserIds = profiles?.map((p) => p.id) || [];

      // Combine both sets of user IDs (remove duplicates)
      const allMatchingUserIds = Array.from(
        new Set([...emailMatchingUserIds, ...profileMatchingUserIds]),
      );

      if (allMatchingUserIds.length === 0) {
        return { users: [], totalCount: 0, totalPages: 0, currentPage: page };
      }

      // Get total count for pagination (email matches + profile matches)
      const totalCount =
        emailMatchingUserIds.length +
        (profileCount || 0) -
        allMatchingUserIds.filter(
          (id) =>
            emailMatchingUserIds.includes(id) &&
            profileMatchingUserIds.includes(id),
        ).length;

      // Apply pagination to the combined results
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedUserIds = allMatchingUserIds.slice(startIndex, endIndex);

      // Get the paginated users
      const paginatedUsers = allUsers.users.filter((user) =>
        paginatedUserIds.includes(user.id),
      );

      // Get profiles for the paginated users
      const { data: userProfiles, error: profileFetchError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", paginatedUserIds);

      if (profileFetchError) {
        throw new Error(
          "Error fetching user profiles: " + profileFetchError.message,
        );
      }

      // Combine users with their profiles
      const combinedUsers = paginatedUsers.map((user) => ({
        ...user,
        profile: userProfiles?.find((profile) => profile.id === user.id),
      }));

      const totalPages = Math.ceil(totalCount / limit);

      return {
        users: combinedUsers,
        totalCount,
        totalPages,
        currentPage: page,
      };
    }

    // No search - get all users with pagination
    const { data: users, error: usersError } =
      await supabase.auth.admin.listUsers();
    if (usersError)
      throw new Error("Error fetching users: " + usersError.message);

    const totalCount = users.users.length;
    const totalPages = Math.ceil(totalCount / limit);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedUsers = users.users.slice(startIndex, endIndex);

    // Fetch corresponding profile data for paginated users
    const userIds = paginatedUsers.map((user) => user.id);
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .in("id", userIds);
    if (profileError)
      throw new Error("Error fetching profiles: " + profileError.message);

    // Combine auth and profile data
    const combinedUsers = paginatedUsers.map((user) => ({
      ...user,
      profile: profiles?.find((profile) => profile.id === user.id),
    }));

    return {
      users: combinedUsers,
      totalCount,
      totalPages,
      currentPage: page,
    };
  },
  ["admin-users-search"],
  {
    revalidate: 300, // 5 minutes cache
    tags: ["admin-users", "users-search"],
  },
);

export async function getUsers(
  search?: string,
  page: number = 1,
  limit: number = 50,
) {
  return getCachedUsers(search, page, limit);
}

export async function updateUserAuth(
  userId: string,
  userData: { email?: string; password?: string },
) {
  // Invalidate cache when user is updated
  revalidatePath("/admin");
  const supabase = await createClient(true);

  // Get current user for logging
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminUserId = user?.id || "unknown";

  logAdminAction(adminUserId, "update_user_auth", {
    targetUserId: userId,
    updatedFields: Object.keys(userData),
  });

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
  const supabase = await createClient(true);
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
  const supabase = await createClient(true);

  // Get current user for logging
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminUserId = user?.id || "unknown";

  logAdminAction(adminUserId, "delete_user", {
    targetUserId: userId,
  });

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw new Error("Error deleting user: " + error.message);
  revalidatePath("/admin");
}

export async function getGroups() {
  const supabase = await createClient(true);
  const { data: groups, error } = await supabase.from("groups").select(`
      *,
      group_members(count)
    `);
  if (error) throw new Error("Error fetching groups: " + error.message);

  // Transform the data to include member_count
  return groups.map((group) => ({
    ...group,
    member_count: group.group_members?.[0]?.count || 0,
  }));
}

export async function updateGroup(
  groupId: string,
  groupData: Partial<Tables<"groups">>,
) {
  const supabase = await createClient(true);
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
  const supabase = await createClient(true);

  // Get current user for logging
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminUserId = user?.id || "unknown";

  logAdminAction(adminUserId, "delete_group", {
    groupId,
  });

  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw new Error("Error deleting group: " + error.message);
  revalidatePath("/admin");
}

export async function getGroupMembers(groupId: string) {
  const supabase = await createClient(true);
  const { data: members, error } = await supabase
    .from("group_members")
    .select(
      `
      id,
      user_id,
      joined_at,
      profiles!inner(
        id,
        full_name,
        username,
        avatar_url
      )
    `,
    )
    .eq("group_id", groupId)
    .order("joined_at", { ascending: false });

  if (error) throw new Error("Error fetching group members: " + error.message);
  return members;
}

export async function getWinningCriteria() {
  const supabase = await createClient(true);
  const { data: criteria, error } = await supabase
    .from("winning_criteria")
    .select("*")
    .order("id");

  if (error)
    throw new Error("Error fetching winning criteria: " + error.message);
  return criteria;
}

export async function getUserAttendances(userId: string) {
  const supabase = await createClient(true);
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
  const supabase = await createClient(true);

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
      festival_id: attendanceData.festival_id!,
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
  const supabase = await createClient(true);
  const { error } = await supabase
    .from("attendances")
    .delete()
    .eq("id", attendanceId);
  if (error) throw new Error("Error deleting attendance: " + error.message);
  revalidatePath("/admin");
}

export async function getTentVisitsForAttendance(userId: string, date: Date) {
  const supabase = await createClient(true);

  // Create start and end of day timestamps for the given date
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: tentVisits, error } = await supabase
    .from("tent_visits")
    .select("tent_id")
    .eq("user_id", userId)
    .gte("visit_date", formatTimestampForDatabase(startOfDay))
    .lte("visit_date", formatTimestampForDatabase(endOfDay));

  if (error) throw new Error("Error fetching tent visits: " + error.message);
  return tentVisits;
}

// Cache management functions removed - NodeCache system deprecated
// Use Next.js unstable_cache and revalidateTag for cache management instead

export async function listNonWebPImages() {
  const supabase = await createClient(true);
  const { data, error } = await supabase.storage.from("avatars").list();

  if (error) throw new Error("Error listing images: " + error.message);

  const nonWebPImages = data
    .filter((file) => !file.name.endsWith(".webp"))
    .map((file) => ({
      path: file.name,
      url: `/api/image/${encodeURIComponent(file.name)}`,
    }));

  return nonWebPImages;
}

export async function convertAndUpdateImage(path: string) {
  const supabase = await createClient(true);

  // Download the image
  const { data, error } = await supabase.storage.from("avatars").download(path);
  if (error) throw new Error("Error downloading image: " + error.message);

  // Convert to WebP
  const webpBuffer = await convertToWebP(await data.arrayBuffer());

  // Upload the converted image
  const fileName = `${path.split(".")[0]}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(fileName, webpBuffer, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError)
    throw new Error("Error uploading converted image: " + uploadError.message);

  // Update the profile
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: fileName })
    .eq("avatar_url", path);

  if (updateError)
    throw new Error("Error updating profile: " + updateError.message);

  // Delete the old image
  await deleteImage(path);

  revalidatePath("/admin");
  return fileName;
}

async function convertToWebP(imageBuffer: ArrayBuffer): Promise<Buffer> {
  try {
    const webpBuffer = await sharp(Buffer.from(imageBuffer))
      .rotate()
      .resize({ width: 800, height: 800, fit: "inside" })
      .webp({ quality: 80 })
      .toBuffer();
    return webpBuffer;
  } catch {
    throw new Error("Error converting image to WebP");
  }
}

async function deleteImage(path: string) {
  const supabase = await createClient(true);
  const { error } = await supabase.storage.from("avatars").remove([path]);
  if (error) throw new Error("Error deleting image: " + error.message);
  revalidatePath("/admin");
}
