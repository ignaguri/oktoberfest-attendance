"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { Tables } from "@/lib/database.types";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import clearCachesByServerAction from "@/utils/revalidate";
import { redirect } from "next/navigation";
import { setCache, getCache, deleteCache } from "@/lib/cache"; // Import cache functions

import type { User } from "@supabase/supabase-js";

const NO_ROWS_ERROR = "PGRST116";

export async function getUser(): Promise<User> {
  const cachedUser = getCache<User>("user");
  if (cachedUser) {
    return cachedUser;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not found");
  }

  setCache("user", user); // Cache the user
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
  deleteCache("user");
  revalidatePath("/", "layout");

  if (redirectTo) {
    redirect(redirectTo);
  } else {
    redirect("/");
  }
}

export async function logout() {
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    redirect("/error");
  }

  // Clear cached user on logout
  deleteCache("user");
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
  deleteCache("user");
}

export async function resetPassword(formData: {
  email: string;
}): Promise<[boolean, string | null]> {
  const supabase = createClient();

  const passwordUpdateUrlBase =
    process.env.NODE_ENV === "development"
      ? process.env.__NEXT_PRIVATE_ORIGIN
      : process.env.NEXT_PUBLIC_APP_URL;
  const passwordResetUrl = `${passwordUpdateUrlBase}/update-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
    redirectTo: passwordResetUrl,
  });

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
  deleteCache("user");
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
  deleteCache("user");
  revalidatePath("/profile");
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
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
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
  return fileName;
}

export async function getProfileShort() {
  const supabase = createClient();
  const user = await getUser();
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(`full_name, username, avatar_url`)
    .eq("id", user.id)
    .single();
  if (!profileData || profileError) {
    throw new Error("Error fetching profile");
  }
  return profileData;
}

export async function getMissingProfileFields() {
  const profileData = await getProfileShort();
  let missingFields = {
    fullName: !profileData.full_name,
    username: !profileData.username,
    avatarUrl: !profileData.avatar_url,
  };
  return missingFields;
}

export async function getUserAndAvatarUrl() {
  const supabase = createClient();
  let user;
  try {
    user = await getUser();
  } catch (error) {
    return { user: null, avatarUrl: null };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select(`avatar_url`)
    .eq("id", user.id)
    .single();
  if (error) {
    throw error;
  }
  return { user, avatarUrl: data.avatar_url };
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
  const data = await fetchAttendancesFromDB(user.id);
  if (!data) {
    return null;
  }
  return Array.isArray(data) ? data : [data];
}

export async function fetchAttendanceByDate(date: Date) {
  const user = await getUser();
  const data = await fetchAttendancesFromDB(user.id, date, true);
  if (!data) {
    return null;
  }
  return Array.isArray(data) ? data[0] : data;
}

export async function addAttendance(formData: { amount: number; date: Date }) {
  const supabase = createClient();
  const user = await getUser();
  const { amount, date } = formData;

  const { error } = await supabase.from("attendances").upsert(
    {
      user_id: user.id,
      date: date.toISOString(),
      beer_count: amount,
    },
    {
      onConflict: "date",
    },
  );

  if (error) {
    throw new Error("Error adding attendance: " + error.message);
  }

  // Invalidate cached attendance data if necessary
  deleteCache(`attendance-${user.id}`);
  revalidatePath("/attendance");
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
    deleteCache(`group-${data.group_id}`);
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
  deleteCache(`group-${groupId}`);
  revalidatePath("/groups");
  return groupId;
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
  clearCachesByServerAction(`/groups/${groupId}`);
  clearCachesByServerAction(`/group-settings/${groupId}`);
  deleteCache(`group-${groupId}`);
  return true;
}

export async function fetchGroupDetails(groupId: string) {
  const cachedData = getCache<Tables<"groups">>("groupDetails-" + groupId);
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

  setCache(`group-${groupId}`, data); // Cache the group details
  return data;
}

export async function fetchGroupMembers(groupId: string) {
  const cachedData = getCache<
    Pick<Tables<"profiles">, "id" | "username" | "full_name">[]
  >("groupMembers-" + groupId);
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
  setCache("groupMembers-" + groupId, groupMembers); // Cache the group members
  return groupMembers;
}

export async function fetchGroupAndMembership(groupId: string) {
  const cachedData = getCache<{
    group: Tables<"groups"> | null;
    isMember: boolean;
  }>("groupAndMembership-" + groupId);
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  const user = await getUser();
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
  if (membershipError && membershipError.code !== "PGRST116") {
    throw new Error("Error checking membership: " + membershipError.message);
  }

  const groupAndMembership = { group, isMember: !!membership };
  setCache("groupAndMembership-" + groupId, groupAndMembership); // Cache the group and membership
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
  clearCachesByServerAction(`/groups/${groupId}`);
  deleteCache(`groupMembers-${groupId}`);
  return true;
}

export async function getCurrentUserForGroup(groupId: string) {
  const cachedData = getCache<{ userId: string; isCreator: boolean }>(
    "currentUserForGroup-" + groupId,
  );
  if (cachedData) {
    return cachedData;
  }

  const supabase = createClient();
  const user = await getUser();
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
  setCache(`currentUserForGroup-${groupId}`, currentUserForGroup); // Cache the current user for the group
  return currentUserForGroup;
}

export async function getGroupName(groupId: string) {
  const cachedData = getCache<string>("groupName-" + groupId);
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

  setCache("groupName-" + groupId, data.name); // Cache the group name
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

  setCache("winningCriterias", data); // Cache the winning criteria
  return data;
}

export async function fetchWinningCriteriaById(id: number) {
  const cachedData = getCache<Tables<"winning_criteria">>(
    "winningCriteriaById-" + id,
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

  setCache("winningCriteriaById-" + id, data); // Cache the winning criteria by ID
  return data;
}

export async function fetchWinningCriteriaByName(name: string) {
  const cachedData = getCache<Tables<"winning_criteria">>(
    "winningCriteriaByName-" + name,
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

  setCache("winningCriteriaByName-" + name, data); // Cache the winning criteria by name
  return data;
}

export async function fetchWinningCriteriaForGroup(groupId: string) {
  const cachedData = getCache<Tables<"winning_criteria">>(
    "winningCriteriaForGroup-" + groupId,
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
  setCache("winningCriteriaForGroup-" + groupId, winningCriteria); // Cache the winning criteria for the group
  return winningCriteria;
}

export async function fetchLeaderboard(groupId: string) {
  const cachedData = getCache<Tables<"leaderboard">[]>(
    "leaderboard-" + groupId,
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

  setCache("leaderboard-" + groupId, data); // Cache the leaderboard
  return data;
}

export async function fetchHighlights() {
  const supabase = createClient();
  type TopPosition = {
    group_id: string;
    group_name: string;
  };
  const user = await getUser();
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
  return {
    topPositions: (firstItem.top_positions as unknown as TopPosition[]) || [],
    totalBeers: firstItem.total_beers || 0,
    daysAttended: firstItem.days_attended || 0,
  };
}
