"use client";

import { ImageModal } from "@/app/(private)/groups/[id]/gallery/ImageModal";
import { AchievementBadge } from "@/components/achievements/AchievementBadge";
import Avatar from "@/components/Avatar/Avatar";
import { Badge } from "@/components/ui/badge";
import { ProfilePreview } from "@/components/ui/profile-preview";
import { formatRelativeTime } from "@/lib/date-utils";
import { useTranslation } from "@/lib/i18n/client";
import { Beer, MapPin, Camera, Users, Clock, Medal } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

import type { ActivityFeedItem } from "@/hooks/useActivityFeed";
import type { AchievementRarity } from "@prostcounter/shared/schemas";
import type { TFunction } from "i18next";

/**
 * Extract file path from a full Supabase storage URL or return the path as-is
 */
function extractFilePath(urlOrPath: string): string {
  if (!urlOrPath.startsWith("http")) {
    return urlOrPath;
  }

  try {
    const url = new URL(urlOrPath);
    const pathParts = url.pathname.split("/");
    const bucketIndex = pathParts.indexOf("beer_pictures");
    if (bucketIndex !== -1) {
      return pathParts.slice(bucketIndex + 1).join("/");
    }
    const publicIndex = pathParts.indexOf("public");
    if (publicIndex !== -1) {
      return pathParts.slice(publicIndex + 2).join("/");
    }
    return urlOrPath;
  } catch {
    return urlOrPath;
  }
}

interface ActivityItemProps {
  activity: ActivityFeedItem;
}

// Type-safe accessor for activity_data properties
const getActivityDataValue = <T,>(
  data: Record<string, unknown>,
  key: string,
  defaultValue: T,
): T => {
  const value = data[key];
  if (value === undefined || value === null) return defaultValue;
  return value as T;
};

const getActivityIcon = (type: ActivityFeedItem["activity_type"]) => {
  switch (type) {
    case "beer_count_update":
      return <Beer className="size-4" />;
    case "tent_checkin":
      return <MapPin className="size-4" />;
    case "photo_upload":
      return <Camera className="size-4" />;
    case "group_join":
      return <Users className="size-4" />;
    case "achievement_unlock":
      return <Medal className="size-4" />;
    default:
      return <Clock className="size-4" />;
  }
};

const getActivityDescription = (activity: ActivityFeedItem, t: TFunction) => {
  const { activity_type, activity_data } = activity;

  switch (activity_type) {
    case "beer_count_update":
      const beerCount = getActivityDataValue<number>(
        activity_data,
        "beer_count",
        0,
      );
      return t("activityFeed.drankBeers", { count: beerCount });

    case "tent_checkin":
      const tentName = getActivityDataValue(
        activity_data,
        "tent_name",
        t("activityFeed.aTent"),
      );
      return t("activityFeed.checkedInto", { tent: tentName });

    case "photo_upload":
      return t("activityFeed.uploadedPhoto");

    case "group_join":
      const groupName = getActivityDataValue(
        activity_data,
        "group_name",
        t("activityFeed.aGroup"),
      );
      return t("activityFeed.joinedGroup", { group: groupName });

    case "achievement_unlock":
      const rarity = getActivityDataValue<string | undefined>(
        activity_data,
        "rarity",
        undefined,
      );
      return rarity
        ? t("activityFeed.unlockedAchievementRarity", {
            rarity: t(`achievements.rarity.${rarity}`),
          })
        : t("activityFeed.unlockedAchievement");

    default:
      return t("activityFeed.hadActivity");
  }
};

export const ActivityItem = ({ activity }: ActivityItemProps) => {
  const { t } = useTranslation();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const {
    username,
    full_name,
    avatar_url,
    activity_time,
    activity_type,
    activity_data,
  } = activity;

  const timeAgo = useMemo(() => {
    try {
      return formatRelativeTime(new Date(activity_time));
    } catch {
      return t("activityFeed.recently");
    }
  }, [activity_time, t]);

  // Show username if available, otherwise fall back to full_name
  const displayName = username || full_name || t("activityFeed.unknownUser");
  const pictureUrl = getActivityDataValue<string | undefined>(
    activity_data,
    "picture_url",
    undefined,
  );
  const imageUrl = pictureUrl
    ? `/api/image/${encodeURIComponent(extractFilePath(pictureUrl))}?bucket=beer_pictures`
    : "";

  return (
    <div className="border-border/50 flex items-start gap-3 border-b py-2 last:border-b-0">
      {/* User Avatar */}
      <ProfilePreview
        username={username}
        fullName={full_name}
        avatarUrl={avatar_url}
        className="flex-shrink-0"
      >
        <Avatar
          url={avatar_url}
          fallback={{
            username: username,
            full_name: full_name,
            email: "no.name@user.com",
          }}
        />
      </ProfilePreview>

      {/* Activity Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-yellow-600">
              {getActivityIcon(activity_type)}
            </span>
            <span className="truncate text-sm font-medium transition-colors hover:text-yellow-600">
              {displayName}
            </span>
          </div>
          <span className="text-muted-foreground text-xs">{timeAgo}</span>
        </div>

        <p className="text-muted-foreground text-left text-sm">
          {getActivityDescription(activity, t)}
        </p>

        {/* Additional badges for special activities */}
        <div className="mt-1 flex items-center gap-2">
          {activity_type === "achievement_unlock" &&
            getActivityDataValue<string | undefined>(
              activity_data,
              "achievement_name",
              undefined,
            ) && (
              <AchievementBadge
                name={getActivityDataValue(
                  activity_data,
                  "achievement_name",
                  "",
                )}
                icon={getActivityDataValue(
                  activity_data,
                  "achievement_icon",
                  "trophy",
                )}
                rarity={getActivityDataValue<AchievementRarity>(
                  activity_data,
                  "rarity",
                  "common",
                )}
                points={getActivityDataValue(
                  activity_data,
                  "achievement_points",
                  0,
                )}
                isUnlocked={true}
                size="sm"
                showPoints={false}
              />
            )}

          {activity_type === "beer_count_update" &&
            getActivityDataValue(activity_data, "beer_count", 0) > 5 && (
              <Badge
                variant="outline"
                className="border-orange-300 bg-orange-100 text-xs text-orange-800"
              >
                {t("activityFeed.hotStreak")}
              </Badge>
            )}
        </div>

        {/* Photo preview for photo uploads */}
        {activity_type === "photo_upload" && pictureUrl && (
          <div className="mt-2">
            <div
              className="bg-muted relative size-16 cursor-pointer overflow-hidden rounded-lg"
              onClick={() => setSelectedImage(imageUrl)}
            >
              <Image
                src={imageUrl}
                alt="Activity photo"
                fill
                className="object-cover transition-transform hover:scale-110"
                sizes="64px"
                unoptimized
              />
            </div>
          </div>
        )}
      </div>

      <ImageModal
        imageUrl={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
};
