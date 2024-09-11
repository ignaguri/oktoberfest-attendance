import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { Leaderboard } from "@/components/Leaderboard";
import LoadingSpinner from "@/components/LoadingSpinner";
import ShareButton from "@/components/ShareButton";
import { JoinGroupForm } from "../JoinGroupForm";
import { WinningCriteria } from "@/lib/types";
import { winningCriteriaText } from "@/lib/constants";

const fetchGroupAndMembership = async (groupId: string) => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { group: null, isMember: false };
  }

  // First, fetch the group data
  const { data: group, error: groupError } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();

  if (groupError) {
    console.error("Error fetching group", groupError);
    return { group: null, isMember: false };
  }

  // Then, check for membership
  const { data: membership, error: membershipError } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();

  if (membershipError && membershipError.code !== "PGRST116") {
    console.error("Error checking membership", membershipError);
  }

  return { group, isMember: !!membership };
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
  const groupData = fetchGroupAndMembership(groupId);
  const leaderboardData = fetchLeaderboard(groupId);

  const [{ group, isMember }, leaderboardEntries] = await Promise.all([
    groupData,
    leaderboardData,
  ]);

  if (!group) {
    redirect("/groups");
  }

  if (!isMember) {
    return (
      <div className="w-full max-w-lg">
        <h2 className="text-2xl font-bold mb-4">
          Join Group &quot;{group.name}&quot;
        </h2>
        <JoinGroupForm groupName={group.name} groupId={group.id} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg">
      <Suspense fallback={<LoadingSpinner />}>
        <div className="flex items-center justify-center mb-4">
          <h2 className="text-3xl font-bold text-center flex-grow pr-2">
            Group &quot;{group.name}&quot;
          </h2>
          <ShareButton
            groupName={group.name}
            groupId={group.id}
            groupPassword={group.password}
          />
        </div>

        {group.description && (
          <p className="text-gray-600 mb-4">{group.description}</p>
        )}

        <p className="text-sm font-medium text-gray-500 mb-4">
          Winning Criteria:{" "}
          {winningCriteriaText[group.winning_criteria as WinningCriteria]}
        </p>

        <div className="flex flex-col gap-4">
          <Leaderboard
            entries={leaderboardEntries ?? []}
            winningCriteria={group.winning_criteria as WinningCriteria}
          />

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
