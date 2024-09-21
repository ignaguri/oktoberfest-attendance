"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { Tables } from "@/lib/database.types";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { redirect } from "next/navigation";
import { setCache, getCache, deleteCache } from "@/lib/cache";
import { isSameDay } from "date-fns/isSameDay";
import { TZDate } from "@date-fns/tz";

import type { User } from "@supabase/supabase-js";

import "server-only";

const NO_ROWS_ERROR = "PGRST116";

// Define the UTC+1 time zone (e.g., 'Europe/Berlin' for CET/CEST)
const TIMEZONE = "Europe/Berlin";

export async function getUser(): Promise<User> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not found");
  }

  setCache(`user-${user.id}`, user); // Cache the user with user-specific key
  return user;
}

export async function login(
  formData: { email: string; password: string },
  redirectTo?: string | null,
) {
  const supabase = createClient();

  const data = {
    email: formData.email,
    password: formData.password,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    throw new Error(error.message);
  }

  // Invalidate the user cache on login
  const user = await getUser();
  deleteCache(`user-${user.id}`);
  revalidatePath("/", "layout");

  if (redirectTo) {
    redirect(redirectTo);
  } else {
    redirect("/");
  }
}

export async function logout() {
  const user = await getUser();
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect("/error");
  }

  // Clear all user-specific cached data
  deleteCache(`user-${user.id}`);
  deleteCache(`groups-${user.id}`);
  // Add more deleteCache calls for other user-specific data as needed

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(formData: { email: string; password: string }) {
  const supabase = createClient();

  const data = {
    email: formData.email,
    password: formData.password,
  };

  const { error } = await supabase.auth.signUp(data);

  if (error) {
    throw new Error(error.message);
  }

  // Invalidate the user cache on sign up
  const user = await getUser();
  deleteCache(`user-${user.id}`);
}

export async function resetPassword(formData: {
  email: string;
}): Promise<[boolean, string | null]> {
  const supabase = createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(formData.email);

  if (error) {
    return [false, error.message];
  } else {
    return [true, null];
  }
}

export async function updatePassword(formData: { password: string }) {
  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({
    password: formData.password,
  });

  if (error) {
    throw new Error(error.message);
  }

  // Invalidate the user cache on password update
  const user = await getUser();
  deleteCache(`user-${user.id}`);
}

export async function updateProfile({
  id,
  fullname,
  username,
}: {
  id: string;
  fullname?: string;
  username?: string;
}) {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").upsert({
    id,
    full_name: fullname,
    username,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(error.message);
  }

  // Invalidate cached user data
  deleteCache(`user-${id}`);
  revalidatePath("/profile");
  revalidatePath("/home");
}

export async function getAvatarId(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", userId)
    .single();
  if (error) {
    throw new Error("Error getting user profile");
  }
  return data.avatar_url;
}

export async function uploadAvatar(formData: FormData) {
  const supabase = createClient();
  const file = formData.get("avatar") as File;
  const userId = formData.get("userId") as string;
  if (!file) {
    throw new Error("No file uploaded");
  }
  if (!userId) {
    throw new Error("User ID is required");
  }
  const buffer = await file.arrayBuffer();
  let compressedBuffer;
  try {
    compressedBuffer = await sharp(buffer)
      .rotate()
      .resize({ width: 800, height: 800, fit: "inside" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    throw new Error("Error compressing image");
  }
  const fileName = `${userId}_${uuidv4()}.webp`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(fileName, compressedBuffer, {
      contentType: "image/webp",
      cacheControl: "3600",
      upsert: false,
    });
  if (error) {
    throw new Error("Error uploading avatar");
  }
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: fileName })
    .eq("id", userId);
  if (updateError) {
    throw new Error("Error updating user profile");
  }
  revalidatePath("/profile");
  revalidatePath("/home");
  revalidatePath("/", "layout");
  return fileName;
}

export async function getProfileShort() {
  const user = await getUser();
  const cachedProfile = getCache<Tables<"profiles">>(`profileShort-${user.id}`);
  if (cachedProfile) {
    return cachedProfile;
  }

  const supabase = createClient();
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(`full_name, username, avatar_url`)
    .eq("id", user.id)
    .single();
  if (!profileData || profileError) {
    throw new Error("Error fetching profile");
  }
  setCache(`profileShort-${user.id}`, profileData);
  return profileData;
}

export async function getMissingProfileFields() {
  const user = await getUser();
  const cachedMissingFields = getCache<{
    fullName: boolean;
    username: boolean;
    avatarUrl: boolean;
  }>(`missingProfileFields-${user.id}`);
  if (cachedMissingFields) {
    return cachedMissingFields;
  }

  const profileData = await getProfileShort();
  let missingFields = {
    fullName: !profileData.full_name,
    username: !profileData.username,
    avatarUrl: !profileData.avatar_url,
  };
  setCache(`missingProfileFields-${user.id}`, missingFields);
  return missingFields;
}

export async function getUserAndAvatarUrl() {
  let user;
  try {
    user = await getUser();
  } catch (error) {
    return { user: null, avatarUrl: null };
  }
  const cachedData = getCache<{ user: User; avatarUrl: string | null }>(
    `userAndAvatarUrl-${user.id}`,
  );
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(`avatar_url`)
    .eq("id", user.id)
    .single();
  if (error) {
    throw error;
  }
  const result = { user, avatarUrl: data.avatar_url };
  setCache(`userAndAvatarUrl-${user.id}`, result);
  return result;
}

async function fetchAttendancesFromDB(
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
    throw new Error(`Error fetching attendances: ${error.message}`);
  }
  return data;
}

export async function fetchAttendances() {
  const user = await getUser();
  const cachedAttendances = getCache<any[]>(`attendances-${user.id}`);
  if (cachedAttendances) {
    return cachedAttendances;
  }

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
          isSameDay(new Date(tentVisit.visit_date), new Date(attendance.date)),
      )
      .map((tentVisit) => {
        const { tents, ...tentVisitWithoutTent } = tentVisit;
        return {
          ...tentVisitWithoutTent,
          tentName: tents?.name,
        };
      }),
  }));

  setCache(`attendances-${user.id}`, attendancesWithTentVisits);
  return attendancesWithTentVisits;
}

export async function fetchAttendanceByDate(date: Date) {
  const user = await getUser();
  const cachedAttendance = getCache<any>(
    `attendanceByDate-${user.id}-${date.toISOString()}`,
  );
  if (cachedAttendance) {
    return cachedAttendance;
  }

  const attendanceData = await fetchAttendancesFromDB(user.id, date, true);

  const supabase = createClient();
  const { data: tentVisits, error: tentVisitsError } = await supabase
    .from("tent_visits")
    .select("tent_id, visit_date")
    .eq("user_id", user.id);

  if (tentVisitsError) {
    throw new Error(`Error fetching tent visits: ${tentVisitsError.message}`);
  }

  // Filter tent visits for the given date as the visit_date is a timestamptz in the db
  // and casting visit_date::date didn't work
  const tentVisitsForDate = tentVisits.filter((tentVisit) =>
    isSameDay(new Date(tentVisit.visit_date || ""), date),
  );

  const attendance = Array.isArray(attendanceData)
    ? attendanceData[0]
    : attendanceData;

  const result = {
    ...attendance,
    tent_ids: tentVisitsForDate.map((visit) => visit.tent_id),
  };
  setCache(`attendanceByDate-${user.id}-${date.toISOString()}`, result);
  return result;
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

  const { error } = await supabase.rpc("add_or_update_attendance_with_tents", {
    p_user_id: user.id,
    p_date: dateWithTime.toISOString(),
    p_beer_count: amount,
    p_tent_ids: tents,
  });

  if (error) {
    throw new Error("Error adding/updating attendance: " + error.message);
  }

  deleteCache(`attendance-${user.id}`);
  deleteCache(`attendances-${user.id}`);
  deleteCache(`attendanceByDate-${user.id}-${date.toISOString()}`);
  deleteCache(`highlights-${user.id}`);
  deleteCache(`topPositions-${user.id}`);
  deleteCache(`totalBeers-${user.id}`);
  deleteCache(`daysAttended-${user.id}`);
  revalidatePath("/attendance");
  revalidatePath("/home");
}

export async function fetchTents() {
  const user = await getUser();
  const cachedTents = getCache<Tables<"tents">[]>(`tents-${user.id}`);
  if (cachedTents && cachedTents.length > 0) {
    return cachedTents;
  }

  const supabase = createClient();
  const { data, error } = await supabase.from("tents").select("*");
  if (error) {
    throw new Error("Error fetching tents: " + error.message);
  }

  setCache(`tents-${user.id}`, data);
  return data;
}

async function fetchGroupsFromDB(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, groups(id, name)")
    .eq("user_id", userId);
  if (error) {
    throw new Error("Error fetching groups: " + error.message);
  }
  const groups = data.map((item) => item.groups) as Tables<"groups">[];
  setCache(`groups-${userId}`, groups);
  return groups;
}

export async function fetchGroups(): Promise<Tables<"groups">[]> {
  const user = await getUser();
  const cachedGroups = getCache<Tables<"groups">[]>(`groups-${user.id}`);
  if (cachedGroups) {
    return cachedGroups;
  }
  return fetchGroupsFromDB(user.id);
}

export async function createGroup(formData: {
  groupName: string;
  password: string;
}) {
  const supabase = createClient();
  const { groupName, password } = formData;
  const user = await getUser();

  const { data, error } = await supabase.rpc("create_group_with_member", {
    p_group_name: groupName.trim(),
    p_password: password.trim(),
    p_user_id: user.id,
  });

  if (error) {
    throw new Error("Error creating group: " + error.message);
  }
  if (data) {
    revalidatePath("/groups");
    revalidatePath(`/groups/${data.group_id}`);
    revalidatePath("/home");
    deleteCache(`group-${user.id}-${data.group_id}`);
    deleteCache(`groups-${user.id}`);
    return data.group_id;
  }
}

export async function joinGroup(formData: {
  groupName: string;
  password: string;
}) {
  const supabase = createClient();
  const { groupName, password } = formData;
  const user = await getUser();

  const { data: groupId, error } = await supabase.rpc("join_group", {
    p_user_id: user.id,
    p_group_name: groupName.trim(),
    p_password: password.trim(),
  });

  if (error || !groupId) {
    throw new Error("Error joining group");
  }

  // Invalidate cached groups data
  deleteCache(`group-${user.id}-${groupId}`);
  deleteCache(`groups-${user.id}`);
  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/home");
  return groupId;
}

export async function joinGroupWithToken(formData: { token: string }) {
  const supabase = createClient();
  const user = await getUser();

  const { data: groupId, error } = await supabase.rpc("join_group_with_token", {
    p_user_id: user.id,
    p_token: formData.token,
  });

  if (error || !groupId) {
    throw new Error("Error joining group with token");
  }

  // Invalidate cached groups data
  deleteCache(`group-${user.id}-${groupId}`);
  deleteCache(`groups-${user.id}`);
  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/home");
  return groupId;
}

export async function renewGroupToken(groupId: string) {
  const supabase = createClient();

  const { data: newToken, error } = await supabase.rpc("renew_group_token", {
    p_group_id: groupId,
  });

  if (error || !newToken) {
    throw new Error("Error renewing group token");
  }

  return newToken;
}

export async function updateGroup(
  groupId: string,
  values: Partial<Tables<"groups">>,
) {
  const supabase = createClient();

  const { error } = await supabase
    .from("groups")
    .update({
      name: values.name,
      password: values.password,
      description: values.description,
      winning_criteria_id: values.winning_criteria_id,
    })
    .eq("id", groupId);
  if (error) {
    throw error;
  }
  const user = await getUser();
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/group-settings/${groupId}`);
  revalidatePath("/groups");
  revalidatePath("/home");
  deleteCache(`group-${user.id}-${groupId}`);
  deleteCache(`groupDetails-${user.id}-${groupId}`);
  deleteCache(`groupAndMembership-${user.id}-${groupId}`);
  return true;
}

export async function fetchGroupDetails(groupId: string) {
  const user = await getUser();
  const cachedData = getCache<Tables<"groups">>(
    `groupDetails-${user.id}-${groupId}`,
  );
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();
  if (error) {
    throw new Error("Error fetching group details: " + error.message);
  }

  setCache(`groupDetails-${user.id}-${groupId}`, data);
  return data;
}

export async function fetchGroupMembers(groupId: string) {
  const user = await getUser();
  const cachedData = getCache<
    Pick<Tables<"profiles">, "id" | "username" | "full_name">[]
  >(`groupMembers-${user.id}-${groupId}`);
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  type PartialProfile = Pick<
    Tables<"profiles">,
    "id" | "username" | "full_name"
  >;
  const { data, error } = await supabase
    .from("group_members")
    .select("profiles:user_id(id, username, full_name)")
    .eq("group_id", groupId);
  if (error) {
    throw new Error("Error fetching group members: " + error.message);
  }

  const groupMembers = data.map((item: any) => item.profiles as PartialProfile);
  setCache(`groupMembers-${user.id}-${groupId}`, groupMembers);
  return groupMembers;
}

export async function fetchGroupAndMembership(groupId: string) {
  const user = await getUser();
  const cachedData = getCache<{
    group: Tables<"groups"> | null;
    isMember: boolean;
  }>(`groupAndMembership-${user.id}-${groupId}`);
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();
  if (groupError) {
    return { group: null, isMember: false };
  }
  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();
  if (membershipError && membershipError.code !== NO_ROWS_ERROR) {
    throw new Error("Error checking membership: " + membershipError.message);
  }

  const groupAndMembership = { group, isMember: !!membership };
  setCache(`groupAndMembership-${user.id}-${groupId}`, groupAndMembership);
  return groupAndMembership;
}

export async function removeMember(groupId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .match({ group_id: groupId, user_id: userId });
  if (error) {
    throw error;
  }
  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/group-settings/${groupId}`);
  revalidatePath("/groups");
  revalidatePath("/home");
  deleteCache(`groupMembers-${userId}-${groupId}`);
  deleteCache(`groups-${userId}`);
  return true;
}

export async function getCurrentUserForGroup(groupId: string) {
  const user = await getUser();
  const cachedData = getCache<{ userId: string; isCreator: boolean }>(
    `currentUserForGroup-${user.id}-${groupId}`,
  );
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("created_by")
    .eq("id", groupId)
    .single();
  if (error) {
    throw error;
  }

  const currentUserForGroup = {
    userId: user.id,
    isCreator: data.created_by === user.id,
  };
  setCache(`currentUserForGroup-${user.id}-${groupId}`, currentUserForGroup);
  return currentUserForGroup;
}

export async function getGroupName(groupId: string) {
  const user = await getUser();
  const cachedData = getCache<string>(`groupName-${user.id}-${groupId}`);
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();
  if (error) {
    return null;
  }

  setCache(`groupName-${user.id}-${groupId}`, data.name);
  return data.name;
}

export async function fetchWinningCriterias() {
  const cachedData = getCache<Tables<"winning_criteria">[]>("winningCriterias");
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  const { data, error } = await supabase.from("winning_criteria").select("*");
  if (error) {
    throw error;
  }

  setCache("winningCriterias", data);
  return data;
}

export async function fetchWinningCriteriaById(id: number) {
  const cachedData = getCache<Tables<"winning_criteria">>(
    `winningCriteriaById-${id}`,
  );
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("winning_criteria")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    throw error;
  }

  setCache(`winningCriteriaById-${id}`, data);
  return data;
}

export async function fetchWinningCriteriaByName(name: string) {
  const cachedData = getCache<Tables<"winning_criteria">>(
    `winningCriteriaByName-${name}`,
  );
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("winning_criteria")
    .select("*")
    .eq("name", name)
    .single();
  if (error) {
    throw error;
  }

  setCache(`winningCriteriaByName-${name}`, data);
  return data;
}

export async function fetchWinningCriteriaForGroup(groupId: string) {
  const user = await getUser();
  const cachedData = getCache<Tables<"winning_criteria">>(
    `winningCriteriaForGroup-${user.id}-${groupId}`,
  );
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("winning_criteria_id")
    .eq("id", groupId)
    .single();
  if (error) {
    throw error;
  }
  if (!data.winning_criteria_id) {
    return null;
  }
  const winningCriteria = await fetchWinningCriteriaById(
    data.winning_criteria_id,
  );
  setCache(`winningCriteriaForGroup-${user.id}-${groupId}`, winningCriteria);
  return winningCriteria;
}

export async function fetchLeaderboard(groupId: string) {
  const user = await getUser();
  const cachedData = getCache<Tables<"leaderboard">[]>(
    `leaderboard-${user.id}-${groupId}`,
  );
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .eq("group_id", groupId)
    .order("total_beers", { ascending: false });
  if (error) {
    throw new Error("Error fetching leaderboard: " + error.message);
  }

  setCache(`leaderboard-${user.id}-${groupId}`, data);
  return data;
}

export async function fetchHighlights() {
  const user = await getUser();
  const cachedHighlights = getCache<{
    topPositions: any[];
    totalBeers: number;
    daysAttended: number;
  }>(`highlights-${user.id}`);
  if (cachedHighlights) {
    return cachedHighlights;
  }

  const supabase = createClient();
  type TopPosition = {
    group_id: string;
    group_name: string;
  };
  const { data, error } = await supabase.rpc("get_user_stats", {
    input_user_id: user.id,
  });
  if (error) {
    return { topPositions: [], totalBeers: 0, daysAttended: 0 };
  }
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { topPositions: [], totalBeers: 0, daysAttended: 0 };
  }
  const firstItem = data[0];
  const result = {
    topPositions: (firstItem.top_positions as unknown as TopPosition[]) || [],
    totalBeers: firstItem.total_beers || 0,
    daysAttended: firstItem.days_attended || 0,
  };
  setCache(`highlights-${user.id}`, result);
  return result;
}
