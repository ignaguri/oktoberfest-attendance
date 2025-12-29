"use server";

import { NO_ROWS_ERROR } from "@/lib/constants";
import { getUser } from "@/lib/sharedActions";
import { reportSupabaseException } from "@/utils/sentry";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";

import type { Tables } from "@/lib/database.types";

import "server-only";

// Cache group details for 10 minutes since group settings change infrequently
const getCachedGroupDetails = unstable_cache(
  async (groupId: string): Promise<Tables<"groups"> | null> => {
    // First check if groupId is a valid UUID format
    if (!groupId || typeof groupId !== "string") {
      throw new Error("Invalid group ID format");
    }

    // Use service role client - group details are accessible to members
    const supabase = await createClient(true);
    const { data, error } = await supabase
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (error) {
      // If no rows found, return null instead of throwing
      if (error.code === NO_ROWS_ERROR) {
        return null;
      }
      reportSupabaseException("fetchGroupDetails", error);
      throw new Error("Error fetching group details: " + error.message);
    }

    return data;
  },
  ["group-details"],
  { revalidate: 600, tags: ["groups"] }, // 10 minutes cache
);

export async function fetchGroupDetails(groupId: string) {
  return getCachedGroupDetails(groupId);
}

/**
 * Type-safe version that returns group data or null
 */
export async function fetchGroupDetailsSafe(
  groupId: string,
): Promise<Tables<"groups"> | null> {
  try {
    return await fetchGroupDetails(groupId);
  } catch (error) {
    // If group not found, return null instead of throwing
    if (
      error instanceof Error &&
      error.message.includes("Invalid group ID format")
    ) {
      return null;
    }
    throw error;
  }
}

// Cache group members for 5 minutes since membership changes occasionally
const getCachedGroupMembers = unstable_cache(
  async (groupId: string): Promise<any[]> => {
    // First check if groupId is a valid UUID format
    if (!groupId || typeof groupId !== "string") {
      throw new Error("Invalid group ID format");
    }

    type PartialProfile = Pick<
      Tables<"profiles">,
      "id" | "username" | "full_name"
    >;

    // Use service role client - group members are accessible to group members
    const supabase = await createClient(true);
    const { data, error } = await supabase
      .from("group_members")
      .select("profiles:user_id(id, username, full_name)")
      .eq("group_id", groupId);

    if (error) {
      reportSupabaseException("fetchGroupMembers", error);
      throw new Error("Error fetching group members: " + error.message);
    }

    const groupMembers =
      data?.map((item: any) => item.profiles as PartialProfile) || [];

    return groupMembers;
  },
  ["group-members"],
  { revalidate: 300, tags: ["groups", "group-members"] }, // 5 minutes cache
);

export async function fetchGroupMembers(groupId: string) {
  return getCachedGroupMembers(groupId);
}

/**
 * Type-safe version that returns group members or empty array
 */
export async function fetchGroupMembersSafe(groupId: string) {
  try {
    return await fetchGroupMembers(groupId);
  } catch (error) {
    // If group not found or invalid, return empty array instead of throwing
    if (
      error instanceof Error &&
      error.message.includes("Invalid group ID format")
    ) {
      return [];
    }
    throw error;
  }
}

export async function updateGroup(
  groupId: string,
  values: Partial<Tables<"groups">>,
) {
  const supabase = await createClient();

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
  revalidateTag("groups", "max");
  revalidateTag("user-groups", "max");

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/group-settings/${groupId}`);
  revalidatePath("/groups");
  revalidatePath("/home");

  return true;
}

export async function removeMember(groupId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("group_members")
    .delete()
    .match({ group_id: groupId, user_id: userId });

  if (error) {
    reportSupabaseException("removeMember", error);
    throw error;
  }

  // Invalidate cache tags for groups and group members
  revalidateTag("groups", "max");
  revalidateTag("group-members", "max");
  revalidateTag("user-groups", "max");

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/group-settings/${groupId}`);
  revalidatePath("/groups");
  revalidatePath("/home");
  return true;
}

export async function getCurrentUserForGroup(groupId: string) {
  const user = await getUser();

  const supabase = await createClient();
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

export async function regenerateInviteToken(groupId: string) {
  const user = await getUser();

  // Verify user is the group creator
  const isCreator = await getCurrentUserForGroup(groupId);
  if (!isCreator.isCreator) {
    throw new Error("Only the group creator can regenerate invite tokens");
  }

  const supabase = await createClient();

  // Use the existing RPC function to regenerate token
  const { data: newToken, error } = await supabase.rpc("renew_group_token", {
    p_group_id: groupId,
  });

  if (error) {
    reportSupabaseException("regenerateInviteToken", error, {
      id: user.id,
      email: user.email,
    });
    throw new Error("Error regenerating invite token: " + error.message);
  }

  // Invalidate cache tags for groups
  revalidateTag("groups", "max");

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/group-settings/${groupId}`);

  return newToken;
}
