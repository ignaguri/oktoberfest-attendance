import { redirect } from "next/navigation";

import GroupsClient from "./GroupsClient";
import { fetchGroups } from "./helpers";
import { createClient } from "@/utils/supabase/server";

export default async function GroupsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const groups = await fetchGroups(supabase, user.id);

  return <GroupsClient groups={groups} />;
}
