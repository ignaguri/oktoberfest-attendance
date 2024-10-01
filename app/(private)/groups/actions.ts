"use server";

import { getUser } from "@/lib/actions";
import { NO_ROWS_ERROR, TIMEZONE } from "@/lib/constants";
import { createClient } from "@/utils/supabase/server";
import { TZDate } from "@date-fns/tz";
import { revalidatePath } from "next/cache";

import type { GalleryData, GalleryItem, PictureData } from "@/lib/types";

import "server-only";

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

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/home");
  return groupId;
}

export async function fetchGroupAndMembership(groupId: string) {
  const user = await getUser();

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
  return groupAndMembership;
}

export async function fetchLeaderboard(groupId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .eq("group_id", groupId)
    .order("total_beers", { ascending: false });

  if (error) {
    throw new Error("Error fetching leaderboard: " + error.message);
  }

  return data;
}

export async function fetchWinningCriteriaById(id: number) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("winning_criteria")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchWinningCriteriaForGroup(groupId: string) {
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

  return winningCriteria;
}

export async function fetchGroupGallery(groupId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fetch_group_gallery", {
    p_group_id: groupId,
  });

  if (error) {
    throw new Error(`Error fetching group gallery: ${error.message}`);
  }

  // maybe use a reducer here?
  const galleryData: GalleryData = {};

  (data as unknown as GalleryItem[]).forEach((item) => {
    const date = new TZDate(item.date, TIMEZONE).toDateString();
    const username = item.username || item.full_name || "Unknown User";

    if (!galleryData[date]) {
      galleryData[date] = {};
    }

    if (!galleryData[date][username]) {
      galleryData[date][username] = [];
    }

    galleryData[date][username] = item.picture_data.map((pic: PictureData) => ({
      id: pic.id,
      url: pic.url,
      uploadedAt: pic.uploadedAt,
      userId: item.user_id,
      username,
    }));
  });

  return galleryData;
}
