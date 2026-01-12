"use client";

import { Leaderboard } from "@/components/Leaderboard";
import LoadingSpinner from "@/components/LoadingSpinner";
import QRButton from "@/components/QR/QRButton";
import ShareButton from "@/components/ShareButton/ShareButton";
import { Button } from "@/components/ui/button";
import { useFestival } from "@/contexts/FestivalContext";
import { useGroupLeaderboard, useGroupSettings } from "@/lib/data";
import { useTranslation } from "@/lib/i18n/client";
import { CalendarDays, Images } from "lucide-react";
import { useParams } from "next/navigation";
import { Link } from "next-view-transitions";

import type { WinningCriteria } from "@/lib/types";

import { JoinGroupForm } from "../JoinGroupForm";

// Map winning criteria to numeric ID for the leaderboard hook
const CRITERIA_TO_ID: Record<WinningCriteria, number> = {
  days_attended: 1,
  total_beers: 2,
  avg_beers: 3,
};

export default function GroupPage() {
  const { t } = useTranslation();
  const params = useParams();
  const groupId = params.id as string;
  const { currentFestival } = useFestival();

  // Fetch group settings
  const {
    data: groupResponse,
    loading: isLoadingGroup,
    error: groupError,
  } = useGroupSettings(groupId);

  // The group data is nested inside the response
  const group = groupResponse?.data;

  // Fetch leaderboard
  const criteriaId = group
    ? CRITERIA_TO_ID[group.winningCriteria as WinningCriteria]
    : 0;
  const { data: leaderboardData, loading: isLoadingLeaderboard } =
    useGroupLeaderboard(groupId, criteriaId, currentFestival?.id || "");

  const isLoading = isLoadingGroup || isLoadingLeaderboard;
  const isMember = group?.isMember ?? false;

  // Loading state
  if (isLoading && !group) {
    return (
      <div className="flex w-full max-w-lg items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (groupError) {
    return (
      <div className="w-full max-w-lg text-center">
        <p className="text-red-500">
          {t("notifications.error.groupLoadFailed")}
        </p>
      </div>
    );
  }

  // No group found
  if (!group) {
    return (
      <div className="w-full max-w-lg text-center">
        <p className="text-gray-500">{t("groups.detail.notFound")}</p>
      </div>
    );
  }

  // Non-member view - show join form
  if (!isMember) {
    return (
      <div className="w-full max-w-lg">
        <h2 className="mb-4 text-2xl font-bold">
          {t("groups.join.title")} &quot;{group.name}&quot;
        </h2>
        <JoinGroupForm groupName={group.name} groupId={group.id} />
      </div>
    );
  }

  // Transform leaderboard entries
  const leaderboardEntries =
    leaderboardData?.map(
      (
        entry: {
          userId: string;
          username: string | null;
          fullName: string | null;
          avatarUrl: string | null;
          daysAttended: number;
          totalBeers: number;
          avgBeers: number;
        },
        index: number,
      ) => ({
        userId: entry.userId,
        username: entry.username,
        fullName: entry.fullName,
        avatarUrl: entry.avatarUrl,
        daysAttended: entry.daysAttended,
        totalBeers: entry.totalBeers,
        avgBeers: entry.avgBeers,
        position: index + 1,
      }),
    ) || [];

  return (
    <div className="w-full max-w-lg">
      <div className="mb-4 flex items-center justify-center">
        <h2 className="grow pr-2 text-center text-3xl font-bold">
          {t("groups.pageTitle")} &quot;{group.name}&quot;
        </h2>
        <ShareButton groupName={group.name} groupId={group.id} />
      </div>

      {group.description && (
        <p className="mb-4 text-gray-600">{group.description}</p>
      )}

      <p className="mb-4 text-sm font-medium text-gray-500">
        {t("groups.create.winningCriteria")}:{" "}
        {t(`groups.winningCriteria.${group.winningCriteria}`)}
      </p>

      <div className="flex flex-col gap-4">
        <Leaderboard
          entries={leaderboardEntries}
          winningCriteria={group.winningCriteria as WinningCriteria}
          showGroupCount={false}
        />

        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href={`/groups/${groupId}/calendar`}>
                <CalendarDays size={24} />
                <span className="ml-2">{t("calendar.title")}</span>
              </Link>
            </Button>
            <Button asChild variant="yellow">
              <Link href={`/groups/${groupId}/gallery`}>
                <Images size={24} />
                <span className="ml-2">{t("groups.settings.gallery")}</span>
              </Link>
            </Button>
          </div>
          <Button asChild variant="darkYellow">
            <Link href={`/group-settings/${groupId}`}>
              {t("groups.settings.title")}
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <QRButton groupName={group.name} groupId={group.id} withText />
            <ShareButton groupName={group.name} groupId={group.id} withText />
          </div>
        </div>
      </div>
    </div>
  );
}
