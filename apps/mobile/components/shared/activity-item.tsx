import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";
import { useTranslation } from "@prostcounter/shared/i18n";
import { getInitials } from "@prostcounter/ui";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Award, Beer, Camera, MapPin, Users } from "lucide-react-native";
import { useMemo, useState, useCallback } from "react";
import { Image } from "react-native";

import { ImagePreviewModal } from "./image-preview-modal";

import type { ActivityFeedItem } from "@prostcounter/shared/hooks";

interface ActivityItemProps {
  activity: ActivityFeedItem;
}

// Type-safe accessor for activity_data properties
function getActivityDataValue<T>(
  data: Record<string, unknown>,
  key: string,
  defaultValue: T,
): T {
  const value = data[key];
  if (value === undefined || value === null) return defaultValue;
  return value as T;
}

// Get icon component for activity type
function getActivityIcon(type: ActivityFeedItem["activity_type"]) {
  switch (type) {
    case "beer_count_update":
      return <Beer size={16} color={IconColors.primary} />;
    case "tent_checkin":
      return <MapPin size={16} color={IconColors.primary} />;
    case "photo_upload":
      return <Camera size={16} color={IconColors.primary} />;
    case "group_join":
      return <Users size={16} color={IconColors.primary} />;
    case "achievement_unlock":
      return <Award size={16} color={IconColors.primary} />;
    default:
      return <Beer size={16} color={IconColors.muted} />;
  }
}

/**
 * Single activity item for the activity feed
 *
 * Features:
 * - User avatar with fallback initials
 * - Activity-specific icon and message
 * - Relative timestamp ("2h ago")
 * - Photo thumbnail for photo_upload type
 */
export function ActivityItem({ activity }: ActivityItemProps) {
  const { t } = useTranslation();
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleImagePress = useCallback((imageUrl: string) => {
    setPreviewImage(imageUrl);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  const {
    username,
    full_name,
    avatar_url,
    activity_time,
    activity_type,
    activity_data,
  } = activity;

  // Format relative time
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(parseISO(activity_time), { addSuffix: true });
    } catch {
      return t("activityFeed.recently", { defaultValue: "recently" });
    }
  }, [activity_time, t]);

  // Get activity description
  const description = useMemo(() => {
    switch (activity_type) {
      case "beer_count_update": {
        const beerCount = getActivityDataValue<number>(
          activity_data,
          "beer_count",
          0,
        );
        return t("activityFeed.drankBeers", {
          defaultValue: `drank ${beerCount} beers`,
          count: beerCount,
        });
      }

      case "tent_checkin": {
        const tentName = getActivityDataValue(
          activity_data,
          "tent_name",
          t("activityFeed.aTent", { defaultValue: "a tent" }),
        );
        return t("activityFeed.checkedInto", {
          defaultValue: `checked into ${tentName}`,
          tent: tentName,
        });
      }

      case "photo_upload":
        return t("activityFeed.uploadedPhoto", {
          defaultValue: "uploaded a photo",
        });

      case "group_join": {
        const groupName = getActivityDataValue(
          activity_data,
          "group_name",
          t("activityFeed.aGroup", { defaultValue: "a group" }),
        );
        return t("activityFeed.joinedGroup", {
          defaultValue: `joined ${groupName}`,
          group: groupName,
        });
      }

      case "achievement_unlock": {
        const achievementName = getActivityDataValue<string | undefined>(
          activity_data,
          "achievement_name",
          undefined,
        );
        return achievementName
          ? t("activityFeed.unlockedAchievementName", {
              defaultValue: `unlocked "${achievementName}"`,
              name: achievementName,
            })
          : t("activityFeed.unlockedAchievement", {
              defaultValue: "unlocked an achievement",
            });
      }

      default:
        return t("activityFeed.hadActivity", {
          defaultValue: "had some activity",
        });
    }
  }, [activity_type, activity_data, t]);

  const displayName = full_name || username || "Unknown";
  const pictureUrl = getActivityDataValue<string | undefined>(
    activity_data,
    "picture_url",
    undefined,
  );

  return (
    <HStack space="sm" className="py-3">
      {/* User Avatar */}
      <Avatar size="sm">
        {avatar_url ? (
          <AvatarImage
            source={{ uri: getAvatarUrl(avatar_url) }}
            alt={displayName}
          />
        ) : (
          <AvatarFallbackText>
            {getInitials({ fullName: full_name, username })}
          </AvatarFallbackText>
        )}
      </Avatar>

      {/* Activity Content */}
      <VStack className="flex-1">
        <HStack className="items-center justify-between">
          <HStack space="xs" className="flex-1 items-center">
            {getActivityIcon(activity_type)}
            <Text
              className="flex-1 text-sm font-medium text-typography-900"
              numberOfLines={1}
            >
              {displayName}
            </Text>
          </HStack>
          <Text className="text-xs text-typography-400">{timeAgo}</Text>
        </HStack>

        <Text className="text-sm text-typography-500">{description}</Text>

        {/* Photo thumbnail for photo uploads */}
        {activity_type === "photo_upload" && pictureUrl && (
          <Pressable
            onPress={() => handleImagePress(pictureUrl)}
            className="mt-2"
          >
            <Image
              source={{ uri: pictureUrl }}
              className="h-16 w-16 rounded-lg"
              resizeMode="cover"
              accessibilityLabel={t("activityFeed.uploadedPhoto", {
                defaultValue: "uploaded a photo",
              })}
            />
          </Pressable>
        )}
      </VStack>

      {/* Image Preview Modal */}
      <ImagePreviewModal imageUri={previewImage} onClose={handleClosePreview} />
    </HStack>
  );
}

ActivityItem.displayName = "ActivityItem";
