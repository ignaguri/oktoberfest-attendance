import GroupSettingsClient from "./GroupSettingsClient";
import { createClient } from "@/utils/supabase/server";

async function fetchGroupDetails(supabase: any, groupId: string) {
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

async function fetchGroupMembers(supabase: any, groupId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("profiles:user_id(id, username, full_name)")
    .eq("group_id", groupId);

  if (error) {
    throw new Error("Error fetching group members: " + error.message);
  }

  return data.map((item: any) => item.profiles);
}

export default async function GroupSettingsPage({
  params,
}: {
  params: { id: string };
}) {
  const groupId = params.id;
  const supabase = createClient();

  const groupData = fetchGroupDetails(supabase, groupId);
  const membersData = fetchGroupMembers(supabase, groupId);

  const [group, members] = await Promise.all([groupData, membersData]);

  return <GroupSettingsClient group={group} members={members} />;
}
