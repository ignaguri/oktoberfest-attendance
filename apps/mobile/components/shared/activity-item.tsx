import { RadlerIcon } from "@/components/icons/radler-icon";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { formatRelativeTime } from "@prostcounter/shared";
import { usePublicProfile } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import {
  Award,
  Beer,
  BeerOff,
  Camera,
  CupSoda,
  MapPin,
  Users,
  Wine,
} from "lucide-react-native";
import { useMemo, useState, useCallback } from "react";
import { Image } from "react-native";

import type { ActivityFeedItem } from "@prostcounter/shared/hooks";

import { ImagePreviewModal } from "./image-preview-modal";
import { TappableAvatar, UserProfileModal } from "./user-profile-modal";

interface ActivityItemProps {
  activity: ActivityFeedItem;
  festivalId?: string;
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

// Get icon for drink type
function getDrinkIcon(drinkType: string | undefined) {
  switch (drinkType) {
    case "beer":
      return <Beer size={16} color={IconColors.primary} />;
    case "radler":
      return <RadlerIcon size={16} color="#84cc16" />; // lime for radler
    case "wine":
      return <Wine size={16} color="#a855f7" />; // purple for wine
    case "soft_drink":
      return <CupSoda size={16} color="#78716C" />; // stone/brown for soft drinks
    case "alcohol_free":
      return <BeerOff size={16} color="#38BDF8" />; // sky-400 (light blue) for alcohol-free
    case "other":
      return <CupSoda size={16} color={IconColors.muted} />;
    default:
      return <Beer size={16} color={IconColors.primary} />;
  }
}

// Get icon component for activity type
function getActivityIcon(
  type: ActivityFeedItem["activity_type"],
  activityData?: Record<string, unknown>,
) {
  switch (type) {
    case "beer_count_update": {
      const drinkType = activityData?.drink_type as string | undefined;
      return getDrinkIcon(drinkType);
    }
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
 * - Tappable avatar opens user profile modal with async loading
 */
export function ActivityItem({ activity, festivalId }: ActivityItemProps) {
  const { t } = useTranslation();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Fetch public profile on demand when modal is opened
  // Use festival_id from activity data, or fallback to prop
  const { data: publicProfile, loading: profileLoading } = usePublicProfile(
    selectedUserId ?? undefined,
    festivalId ?? activity.festival_id,
  );

  const handleImagePress = useCallback((imageUrl: string) => {
    setPreviewImage(imageUrl);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewImage(null);
  }, []);

  const handleAvatarPress = useCallback(() => {
    setSelectedUserId(activity.user_id);
  }, [activity.user_id]);

  const handleCloseProfileModal = useCallback(() => {
    setSelectedUserId(null);
  }, []);

  const {
    username,
    full_name,
    avatar_url,
    activity_time,
    activity_type,
    activity_data,
  } = activity;

  // Format relative time using shared utility
  const timeAgo = useMemo(() => {
    try {
      return formatRelativeTime(new Date(activity_time));
    } catch {
      return t("activityFeed.recently");
    }
  }, [activity_time, t]);

  // Get activity description
  const description = useMemo(() => {
    switch (activity_type) {
      case "beer_count_update": {
        // Check if we have drink_type and drink_count for new consumption system
        const drinkType = getActivityDataValue<string | undefined>(
          activity_data,
          "drink_type",
          undefined,
        );
        const drinkCount = getActivityDataValue<number>(
          activity_data,
          "drink_count",
          0,
        );

        // Fall back to beer_count for old activities
        const beerCount = getActivityDataValue<number>(
          activity_data,
          "beer_count",
          drinkCount || 0,
        );

        // If we have a specific drink type, use it with pluralization
        if (drinkType && drinkCount > 0) {
          return t(`activityFeed.drank_${drinkType}`, {
            count: drinkCount,
          });
        }

        // Fall back to showing beers for old data
        return t("activityFeed.drankBeers", {
          count: beerCount,
        });
      }

      case "tent_checkin": {
        const tentName = getActivityDataValue(
          activity_data,
          "tent_name",
          t("activityFeed.aTent"),
        );
        return t("activityFeed.checkedInto", {
          tent: tentName,
        });
      }

      case "photo_upload":
        return t("activityFeed.uploadedPhoto");

      case "group_join": {
        const groupName = getActivityDataValue(
          activity_data,
          "group_name",
          t("activityFeed.aGroup"),
        );
        return t("activityFeed.joinedGroup", {
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
              name: achievementName,
            })
          : t("activityFeed.unlockedAchievement");
      }

      default:
        return t("activityFeed.hadActivity");
    }
  }, [activity_type, activity_data, t]);

  // Show username if available, otherwise fall back to full_name
  const displayName = username || full_name || "Unknown";
  const pictureUrl = getActivityDataValue<string | undefined>(
    activity_data,
    "picture_url",
    undefined,
  );

  return (
    <>
      <HStack space="sm" className="py-3">
        {/* User Avatar - Tappable to show profile */}
        <TappableAvatar
          avatarUrl={avatar_url}
          username={username}
          fullName={full_name}
          onPress={handleAvatarPress}
        />

        {/* Activity Content */}
        <VStack className="flex-1">
          <HStack className="items-center justify-between">
            <HStack space="xs" className="flex-1 items-center">
              {getActivityIcon(activity_type, activity_data)}
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
                accessibilityLabel={t("activityFeed.uploadedPhoto")}
              />
            </Pressable>
          )}
        </VStack>

        {/* Image Preview Modal */}
        <ImagePreviewModal
          imageUri={previewImage}
          onClose={handleClosePreview}
        />
      </HStack>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={!!selectedUserId}
        onClose={handleCloseProfileModal}
        profile={publicProfile}
        loading={profileLoading}
      />
    </>
  );
}

ActivityItem.displayName = "ActivityItem";
