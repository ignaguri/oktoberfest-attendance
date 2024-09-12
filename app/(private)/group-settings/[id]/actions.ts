"use server";

import { Tables } from "@/lib/database.types";
import { createClient } from "@/utils/supabase/server";

export const updateGroup = async (
  groupId: string,
  values: Partial<Tables<"groups">>,
) => {
  const supabase = createClient();

  const { error } = await supabase
    .from("groups")
    .update({
      name: values.name,
      password: values.password,
      description: values.description,
      winning_criteria: values.winning_criteria,
    })
    .eq("id", groupId);

  if (error) {
    throw error;
  }

  return true;
};

export const removeMember = async (groupId: string, userId: string) => {
  const supabase = createClient();

  const { error } = await supabase
    .from("group_members")
    .delete()
    .match({ group_id: groupId, user_id: userId });

  if (error) {
    throw error;
  }

  return true;
};

export const getCurrentUser = async (groupId: string) => {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return false;
  }

  const { data, error } = await supabase
    .from("groups")
    .select("created_by")
    .eq("id", groupId)
    .single();

  if (error) {
    throw error;
  }

  return { userId: user.id, isCreator: data.created_by === user.id };
};
