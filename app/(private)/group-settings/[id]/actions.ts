"use server";

import { getUser } from "@/lib/sharedActions";
import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

import type { Tables } from "@/lib/database.types";

import "server-only";

// Cache group details for 10 minutes since group settings change infrequently
const getCachedGroupDetails = unstable_cache(
  async (groupId: string, supabaseClient: any) => {
    const { data, error } = await supabaseClient
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .single();
    if (error) {
      reportSupabaseException("fetchGroupDetails", error);
      throw new Error("Error fetching group details: " + error.message);
    }

    return data;
  },
  ["group-details"],
  { revalidate: 600, tags: ["groups"] }, // 10 minutes cache
);

export async function fetchGroupDetails(groupId: string) {
  const supabase = createClient();
  return getCachedGroupDetails(groupId, supabase);
}

// Cache group members for 5 minutes since membership changes occasionally
const getCachedGroupMembers = unstable_cache(
  async (groupId: string, supabaseClient: any) => {
    type PartialProfile = Pick<
      Tables<"profiles">,
      "id" | "username" | "full_name"
    >;

    const { data, error } = await supabaseClient
      .from("group_members")
      .select("profiles:user_id(id, username, full_name)")
      .eq("group_id", groupId);

    if (error) {
      reportSupabaseException("fetchGroupMembers", error);
      throw new Error("Error fetching group members: " + error.message);
    }

    const groupMembers = data.map(
      (item: any) => item.profiles as PartialProfile,
    );

    return groupMembers;
  },
  ["group-members"],
  { revalidate: 300, tags: ["groups", "group-members"] }, // 5 minutes cache
);

export async function fetchGroupMembers(groupId: string) {
  const supabase = createClient();
  return getCachedGroupMembers(groupId, supabase);
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
    reportSupabaseException("updateGroup", error);
    throw error;
  }

  // Invalidate cache tags for groups
  revalidateTag("groups");
  revalidateTag("user-groups");

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/group-settings/${groupId}`);
  revalidatePath("/groups");
  revalidatePath("/home");

  return true;
}

export async function removeMember(groupId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .match({ group_id: groupId, user_id: userId });

  if (error) {
    reportSupabaseException("removeMember", error);
    throw error;
  }

  // Invalidate cache tags for groups and group members
  revalidateTag("groups");
  revalidateTag("group-members");
  revalidateTag("user-groups");

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/group-settings/${groupId}`);
  revalidatePath("/groups");
  revalidatePath("/home");
  return true;
}

export async function getCurrentUserForGroup(groupId: string) {
  const user = await getUser();

  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("created_by")
    .eq("id", groupId)
    .single();

  if (error) {
    reportSupabaseException("getCurrentUserForGroup", error, {
      id: user.id,
      email: user.email,
    });
    throw error;
  }

  const currentUserForGroup = {
    userId: user.id,
    isCreator: data.created_by === user.id,
  };

  return currentUserForGroup;
}
