"use client";

import { useFestival } from "@prostcounter/shared/contexts";
import { useProfileDetail, useProfileFestivalDays } from "@prostcounter/shared/hooks";
import type { ProfileDayRow, ProfileDetail, ProfileHistoryRow } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { parseISO } from "date-fns";
import {
  Beer,
  Calendar,
  ChevronDown,
  ChevronRight,
  Loader2,
  Tent,
  TrendingUp,
  Users,
} from "lucide-react";
import { Link } from "next-view-transitions";
import { useParams } from "next/navigation";
import { useState } from "react";

import { TaggedPhotosStrip } from "@/components/photo-tags/TaggedPhotosStrip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarViewerDialog } from "@/components/ui/avatar-viewer-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FriendshipBadge } from "@/components/ui/profile-preview";
import { useTranslation } from "@/lib/i18n/client";
import { getAvatarUrl } from "@/lib/utils";

function FestivalHistoryRow({ row, userId }: { row: ProfileHistoryRow; userId: string }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const daysQuery = useProfileFestivalDays(userId, row.festivalId, { enabled: isExpanded });
  // The shared ApiClient type is `any` to avoid a cyclic dependency, so the
  // hooks hand back `any`. Annotate here to get real checking on the page.
  const days: ProfileDayRow[] | null = daysQuery.data;
  const loading: boolean = daysQuery.loading;

  return (
    <div className="border-t py-3 first:border-t-0">
      <button
        type="button"
        onClick={() => setIsExpanded((open) => !open)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={isExpanded}
      >
        <span>
          <span className="block font-medium text-gray-900">{row.festivalName}</span>
          <span className="block text-xs text-gray-500">
            {t("profile.page.days", { count: row.daysAttended })}
            {" · "}
            {t("profile.page.drinks", { count: row.totalBeers })}
          </span>
        </span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1 pl-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />}
          {(days ?? []).map((day) => (
            <div key={day.date} className="flex items-center gap-3 text-sm">
              <span className="text-gray-700">{formatLocalized(parseISO(day.date), "MMM d")}</span>
              <span className="text-gray-500">
                {t("profile.page.drinks", { count: day.totalDrinks })}
              </span>
              {day.tents.length > 0 && (
                <span className="flex-1 text-xs text-gray-400">{day.tents.join(", ")}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UserProfilePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { currentFestival } = useFestival();
  const profileQuery = useProfileDetail(id, currentFestival?.id);
  // See the note in FestivalHistoryRow: the shared hooks return `any`.
  const profile: ProfileDetail | null = profileQuery.data;
  const loading: boolean = profileQuery.loading;
  // `data` is null on failure too, so without this a 500 would read as
  // "profile not found".
  const error: Error | null = profileQuery.error;
  const refetch: () => void = profileQuery.refetch;
  const [isAvatarViewerOpen, setIsAvatarViewerOpen] = useState(false);

  if (loading) {
    return (
      <div className="container mx-auto flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto space-y-4 py-12 text-center">
        <p className="text-gray-600">{t("common.status.error")}</p>
        <Button variant="outline" onClick={() => refetch()}>
          {t("common.actions.retry")}
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-12 text-center text-gray-600">
        {t("profile.page.notFound")}
      </div>
    );
  }

  const displayName = profile.username || profile.fullName || "Unknown";
  const fallbackInitial = displayName.charAt(0).toUpperCase();
  const fullSizeAvatarUrl = profile.avatarUrl ? getAvatarUrl(profile.avatarUrl) : null;

  return (
    <>
      <div className="container mx-auto max-w-2xl space-y-6 py-8">
        <div className="flex flex-col items-center gap-3">
          {fullSizeAvatarUrl ? (
            <button
              type="button"
              onClick={() => setIsAvatarViewerOpen(true)}
              aria-label={t("profile.avatar.viewFullSize")}
              className="rounded-full transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-yellow-500 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Avatar className="h-24 w-24">
                <AvatarImage src={fullSizeAvatarUrl} alt={displayName} />
                <AvatarFallback className="bg-yellow-100 text-2xl text-yellow-800">
                  {fallbackInitial}
                </AvatarFallback>
              </Avatar>
            </button>
          ) : (
            <Avatar className="h-24 w-24">
              <AvatarFallback className="bg-yellow-100 text-2xl text-yellow-800">
                {fallbackInitial}
              </AvatarFallback>
            </Avatar>
          )}

          <div className="text-center">
            {profile.username && <h1 className="text-xl font-semibold">{profile.username}</h1>}
            {profile.fullName && <p className="text-sm text-gray-600">{profile.fullName}</p>}
            {profile.friendsSince && (
              <p className="text-xs text-gray-400">
                {t("friends.friendsSince", {
                  date: formatLocalized(parseISO(profile.friendsSince), "MMM d, yyyy"),
                })}
              </p>
            )}
          </div>

          {profile.friendshipStatus && profile.friendshipStatus !== "self" && (
            <FriendshipBadge status={profile.friendshipStatus} userId={id} />
          )}
        </div>

        {/* The private layout centres <main>, so each card opts back out. */}
        <TaggedPhotosStrip
          userId={id}
          festivalId={currentFestival?.id}
          title={
            profile.friendshipStatus === "self"
              ? t("photoTags.strip.titleSelf")
              : t("photoTags.strip.titleOther", {
                  name: profile.fullName || profile.username || "",
                })
          }
        />

        {profile.sharedGroups.length > 0 && (
          <Card className="gap-3 text-left">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Users className="h-4 w-4" />
                {t("profile.page.sharedGroups")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {profile.sharedGroups.map((group) => (
                <Link
                  key={group.id}
                  href={`/groups/${group.id}`}
                  className="rounded-full bg-yellow-50 px-3 py-1 text-sm text-yellow-800 hover:bg-yellow-100"
                >
                  {group.name}
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {profile.stats && (
          <Card>
            <CardContent className="flex justify-center gap-8">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-xl font-bold">{profile.stats.daysAttended}</span>
                </div>
                <span className="text-xs text-gray-500">{t("leaderboard.stats.days")}</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <Beer className="h-4 w-4 text-gray-400" />
                  <span className="text-xl font-bold">{profile.stats.totalBeers}</span>
                </div>
                <span className="text-xs text-gray-500">{t("leaderboard.stats.drinks")}</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                  <span className="text-xl font-bold">{profile.stats.avgBeers.toFixed(1)}</span>
                </div>
                <span className="text-xs text-gray-500">{t("leaderboard.stats.avg")}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {profile.favouriteTent && (
          <Card className="gap-3 text-left">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Tent className="h-4 w-4" />
                {t("profile.page.favouriteTent")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{profile.favouriteTent.name}</p>
              <p className="text-xs text-gray-500">
                {t("profile.page.favouriteTentVisits", { count: profile.favouriteTent.visits })}
              </p>
            </CardContent>
          </Card>
        )}

        {profile.history.length > 0 && (
          <Card className="gap-3 text-left">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-600">
                {t("profile.page.history")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.history.map((row) => (
                <FestivalHistoryRow key={row.festivalId} row={row} userId={id} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {fullSizeAvatarUrl && (
        <AvatarViewerDialog
          open={isAvatarViewerOpen}
          onOpenChange={setIsAvatarViewerOpen}
          imageUrl={fullSizeAvatarUrl}
          name={displayName}
        />
      )}
    </>
  );
}
