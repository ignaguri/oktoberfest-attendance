import Link from "next/link";
import { Suspense } from "react";

import { createClient } from "@/utils/supabase/server";
import { Leaderboard } from "@/components/Leaderboard";
import LoadingSpinner from "@/components/LoadingSpinner";
import ShareButton from "@/components/ShareButton";

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
    <div className="w-full max-w-lg">
      <Suspense fallback={<LoadingSpinner />}>
        <div className="flex items-center justify-center mb-4">
          <h2 className="text-3xl font-bold text-center flex-grow pr-2">
            Group &quot;{group?.name}&quot;
          </h2>
          <ShareButton
            groupName={group?.name ?? ""}
            groupPassword={group?.password ?? ""}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Leaderboard entries={leaderboardEntries ?? []} />

          <div className="flex flex-col gap-4 items-center">
            <Link className="button-inverse w-fit" href="/attendance">
              Register attendance
            </Link>
            <Link className="button w-fit" href={`/group-settings/${groupId}`}>
              Group Settings
            </Link>
          </div>
        </div>
      </Suspense>
    </div>
  );
}
