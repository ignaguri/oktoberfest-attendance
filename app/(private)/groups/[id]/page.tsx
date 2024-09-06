import Link from "next/link";
import { Suspense } from "react";

import { createClient } from "@/utils/supabase/server";
import { Leaderboard } from "@/components/Leaderboard";
import LoadingSpinner from "@/components/LoadingSpinner";

const fetchGroup = async (groupId: string) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();

  if (error) {
    console.error("Error fetching group", error);
    return null;
  }

  return data;
};

const fetchLeaderboard = async (groupId: string) => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .eq("group_id", groupId)
    .order("total_beers", { ascending: false });

  if (error) {
    console.error("Error fetching leaderboard", error);
    return null;
  }

  return data;
};

export default async function GroupPage({
  params,
}: {
  params: { id: string };
}) {
  const groupId = params.id;
  const groupData = fetchGroup(groupId);
  const leaderboardData = fetchLeaderboard(groupId);

  const [group, leaderboardEntries] = await Promise.all([
    groupData,
    leaderboardData,
  ]);

  return (
    <div className="container w-full">
      <Suspense fallback={<LoadingSpinner />}>
        <h2 className="text-3xl font-bold">Group &quot;{group?.name}&quot;</h2>

        <div className="flex flex-col gap-4">
          <Leaderboard entries={leaderboardEntries ?? []} />

          <Link className="button-inverse" href="/attendance">
            Register attendance
          </Link>
          <Link className="button" href={`/group-settings/${groupId}`}>
            Group Settings
          </Link>
        </div>
      </Suspense>
    </div>
  );
}
