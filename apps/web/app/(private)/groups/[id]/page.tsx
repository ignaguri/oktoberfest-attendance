import { Leaderboard } from "@/components/Leaderboard";
import LoadingSpinner from "@/components/LoadingSpinner";
import QRButton from "@/components/QR/QRButton";
import ShareButton from "@/components/ShareButton/ShareButton";
import { Button } from "@/components/ui/button";
import { winningCriteriaText } from "@/lib/constants";
import { CalendarDays, Images } from "lucide-react";
import { redirect } from "next/navigation";
import { Link } from "next-view-transitions";
import { Suspense } from "react";

import type { WinningCriteria } from "@/lib/types";

import {
  fetchGroupAndMembership,
  fetchLeaderboard,
  fetchWinningCriteriaForGroup,
} from "../actions";
import { JoinGroupForm } from "../JoinGroupForm";

// Transform snake_case DB response to camelCase for Leaderboard component
function transformLeaderboardEntries(
  entries: Awaited<ReturnType<typeof fetchLeaderboard>>,
) {
  return entries.map((entry, index) => ({
    userId: entry.user_id,
    username: entry.username,
    fullName: entry.full_name,
    avatarUrl: entry.avatar_url,
    daysAttended: entry.days_attended,
    totalBeers: entry.total_beers,
    avgBeers: entry.avg_beers,
    position: index + 1,
  }));
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: groupId } = await params;
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
          <h2 className="text-3xl font-bold text-center grow pr-2">
            Group &quot;{group.name}&quot;
          </h2>
          <ShareButton groupName={group.name} groupId={group.id} />
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
            entries={transformLeaderboardEntries(leaderboardEntries ?? [])}
            winningCriteria={winningCriteria?.name as WinningCriteria}
            showGroupCount={false}
          />

          <div className="flex flex-col gap-4 items-center">
            <div className="flex gap-2 items-center">
              <Button asChild variant="outline">
                <Link href={`/groups/${groupId}/calendar`}>
                  <CalendarDays size={24} />
                  <span className="ml-2">Calendar</span>
                </Link>
              </Button>
              <Button asChild variant="yellow">
                <Link href={`/groups/${groupId}/gallery`}>
                  <Images size={24} />
                  <span className="ml-2">Gallery</span>
                </Link>
              </Button>
              {/* TODO: enable this when location sharing works
               <Button asChild variant="outline">
                <Link href={`/groups/${groupId}/location`}>
                  <MapPin size={24} />
                  <span className="ml-2">Location</span>
                </Link>
              </Button> */}
            </div>
            <Button asChild variant="darkYellow">
              <Link href={`/group-settings/${groupId}`}>Group Settings</Link>
            </Button>
            <div className="flex gap-2 items-center">
              <QRButton groupName={group.name} groupId={group.id} withText />
              <ShareButton groupName={group.name} groupId={group.id} withText />
            </div>
          </div>
        </div>
      </Suspense>
    </div>
  );
}
