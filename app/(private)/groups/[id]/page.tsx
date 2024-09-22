import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { Leaderboard } from "@/components/Leaderboard";
import LoadingSpinner from "@/components/LoadingSpinner";
import ShareButton from "@/components/ShareButton";
import { JoinGroupForm } from "../JoinGroupForm";
import { WinningCriteria } from "@/lib/types";
import { winningCriteriaText } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  fetchGroupAndMembership,
  fetchLeaderboard,
  fetchWinningCriteriaForGroup,
} from "@/lib/actions";
import { Images } from "lucide-react";

export default async function GroupPage({
  params,
}: {
  params: { id: string };
}) {
  const groupId = params.id;
  const groupData = fetchGroupAndMembership(groupId);
  const leaderboardData = fetchLeaderboard(groupId);
  const winningCriteriaData = fetchWinningCriteriaForGroup(groupId);

  const [{ group, isMember }, leaderboardEntries, winningCriteria] =
    await Promise.all([groupData, leaderboardData, winningCriteriaData]);

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
          {winningCriteriaText[winningCriteria?.name as WinningCriteria]}
        </p>

        <div className="flex flex-col gap-4">
          <Leaderboard
            entries={leaderboardEntries ?? []}
            winningCriteria={winningCriteria?.name as WinningCriteria}
            showGroupCount={false}
          />

          <div className="flex flex-col gap-4 items-center">
            <Button asChild variant="default">
              <Link href={`/groups/${groupId}/gallery`}>
                <Images size={24} />
                <span className="ml-2">Gallery</span>
              </Link>
            </Button>
            <Button asChild variant="darkYellow">
              <Link href={`/group-settings/${groupId}`}>Group Settings</Link>
            </Button>
            <ShareButton
              groupName={group.name}
              groupId={group.id}
              groupPassword={group.password}
              withText
            />
            <Button asChild variant="yellowOutline">
              <Link href="/attendance">Register attendance</Link>
            </Button>
          </div>
        </div>
      </Suspense>
    </div>
  );
}
