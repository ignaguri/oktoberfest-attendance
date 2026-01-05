"use client";

import { ImageModal } from "@/app/(private)/groups/[id]/gallery/ImageModal";
import { AchievementBadge } from "@/components/achievements/AchievementBadge";
import Avatar from "@/components/Avatar/Avatar";
import { Badge } from "@/components/ui/badge";
import { ProfilePreview } from "@/components/ui/profile-preview";
import { formatRelativeTime } from "@/lib/date-utils";
import { Beer, MapPin, Camera, Users, Clock, Medal } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

import type { ActivityFeedItem } from "@/hooks/useActivityFeed";
import type { AchievementRarity } from "@prostcounter/shared/schemas";

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

const getActivityDescription = (activity: ActivityFeedItem) => {
  const { activity_type, activity_data } = activity;

  switch (activity_type) {
    case "beer_count_update":
      const beerCount = getActivityDataValue<number>(
        activity_data,
        "beer_count",
        0,
      );
      return `drank ${beerCount} beer${beerCount !== 1 ? "s" : ""}`;

    case "tent_checkin":
      const tentName = getActivityDataValue(
        activity_data,
        "tent_name",
        "a tent",
      );
      return `checked into ${tentName}`;

    case "photo_upload":
      return `uploaded a photo`;

    case "group_join":
      const groupName = getActivityDataValue(
        activity_data,
        "group_name",
        "a group",
      );
      return `joined ${groupName}`;

    case "achievement_unlock":
      const rarity = getActivityDataValue<string | undefined>(
        activity_data,
        "rarity",
        undefined,
      );
      return `unlocked an achievement${rarity ? ` (${rarity})` : ""}`;

    default:
      return "had some activity";
  }
};

export const ActivityItem = ({ activity }: ActivityItemProps) => {
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
      return "recently";
    }
  }, [activity_time]);

  const displayName = full_name || username || "Unknown User";
  const pictureUrl = getActivityDataValue<string | undefined>(
    activity_data,
    "picture_url",
    undefined,
  );
  const imageUrl = pictureUrl
    ? `/api/image/${pictureUrl}?bucket=beer_pictures`
    : "";

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-b-0">
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
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center gap-2">
            <span className="text-yellow-600">
              {getActivityIcon(activity_type)}
            </span>
            <span className="text-sm font-medium hover:text-yellow-600 transition-colors truncate">
              {displayName}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
        </div>

        <p className="text-sm text-muted-foreground text-left">
          {getActivityDescription(activity)}
        </p>

        {/* Additional badges for special activities */}
        <div className="flex items-center gap-2 mt-1">
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
                className="text-xs bg-orange-100 text-orange-800 border-orange-300"
              >
                🔥 Hot streak
              </Badge>
            )}
        </div>

        {/* Photo preview for photo uploads */}
        {activity_type === "photo_upload" && pictureUrl && (
          <div className="mt-2">
            <div
              className="size-16 rounded-lg overflow-hidden bg-muted relative cursor-pointer"
              onClick={() => setSelectedImage(imageUrl)}
            >
              <Image
                src={imageUrl}
                alt="Activity photo"
                fill
                className="object-cover hover:scale-110 transition-transform"
                sizes="64px"
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
