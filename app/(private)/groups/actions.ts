"use server";

import { Tables } from "@/lib/database.types";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function fetchGroups(): Promise<Tables<"groups">[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return [];
  }

  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, groups(id, name)")
    .eq("user_id", user?.id);

  if (error) {
    throw new Error("Error fetching groups: " + error.message);
  }

  const groups = data.map((item) => item.groups) as Tables<"groups">[];

  return groups;
}

export async function createGroup(formData: FormData) {
  const groupName = formData.get("groupName") as string;
  const password = formData.get("password") as string;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return;
  }

  const { data, error } = await supabase.rpc("create_group_with_member", {
    p_group_name: groupName,
    p_password: password,
    p_user_id: user.id,
  });

  if (error) {
    console.error("Error creating group", error);
    return;
  }

  if (data) {
    revalidatePath("/groups");
    redirect(`/groups/${data.group_id}`);
  }
}

export async function joinGroup(formData: FormData) {
  const groupName = formData.get("groupName") as string;
  const password = formData.get("password") as string;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return;
  }

  const { data: groupId, error } = await supabase.rpc("join_group", {
    p_user_id: user.id,
    p_group_name: groupName,
    p_password: password,
  });

  if (error || !groupId) {
    console.error("Error joining group", error);
    return;
  }

  revalidatePath("/groups");
  redirect(`/groups/${groupId}`);
}
