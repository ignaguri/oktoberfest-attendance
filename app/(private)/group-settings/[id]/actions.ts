"use server";

import { getUser } from "@/lib/actions";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

import type { Tables } from "@/lib/database.types";

import "server-only";

export async function fetchGroupDetails(groupId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();
  if (error) {
    throw new Error("Error fetching group details: " + error.message);
  }

  return data;
}

export async function fetchGroupMembers(groupId: string) {
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

  return groupMembers;
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
    throw error;
  }

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
    throw error;
  }

  const currentUserForGroup = {
    userId: user.id,
    isCreator: data.created_by === user.id,
  };

  return currentUserForGroup;
}
