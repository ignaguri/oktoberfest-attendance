export async function fetchGroups(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, groups(id, name)")
    .eq("user_id", userId);

  if (error) {
    throw new Error("Error fetching groups: " + error.message);
  }

  return data.map((item: any) => item.groups);
}
