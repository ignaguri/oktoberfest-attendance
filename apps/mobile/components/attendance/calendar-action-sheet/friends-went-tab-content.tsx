import { useTranslation } from "@prostcounter/shared/i18n";
import type { FriendWent } from "@prostcounter/shared/schemas";
import { getInitials } from "@prostcounter/ui";
import { MapPin } from "lucide-react-native";
import { useState } from "react";
import { Image, View } from "react-native";

import { Avatar, AvatarFallbackText, AvatarImage } from "@/components/ui/avatar";
import { ErrorState } from "@/components/ui/error-state";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { getAvatarUrl, getBeerPictureUrl } from "@/lib/utils";

/** Rows shown before "+N more", matching "Who's going". */
const COLLAPSED_COUNT = 3;

function PhotoStrip({ friend }: { friend: FriendWent }) {
  const hiddenPhotoCount = friend.photoCount - friend.photos.length;

  return (
    <HStack space="xs">
      {friend.photos.map((photo) => {
        const imageUrl = getBeerPictureUrl(photo.pictureUrl);
        if (!imageUrl) {
          return null;
        }
        return (
          <Image
            key={photo.id}
            source={{ uri: imageUrl }}
            className="h-12 w-12 rounded-md bg-background-100"
            resizeMode="cover"
            alt=""
          />
        );
      })}
      {hiddenPhotoCount > 0 && (
        <View className="h-12 w-12 items-center justify-center rounded-md bg-background-100">
          <Text className="text-xs font-semibold text-typography-600">{`+${hiddenPhotoCount}`}</Text>
        </View>
      )}
    </HStack>
  );
}

function FriendRow({
  friend,
  onOpenGallery,
}: {
  friend: FriendWent;
  onOpenGallery: (groupId: string) => void;
}) {
  const { t } = useTranslation();
  const displayName = friend.username || friend.fullName || t("attendance.planner.unknownFriend");
  const totalLabel =
    friend.totalDrinks > 0
      ? t("attendance.drinkCount", { count: friend.totalDrinks })
      : t("attendance.friendsWent.noDrinks");
  const breakdown = friend.drinks
    .map(
      (drink) =>
        `${drink.count} ${t(`attendance.drinkTypes.${drink.type}`, { count: drink.count })}`,
    )
    .join(" · ");
  const tents = friend.tents.join(", ");
  const photosLabel =
    friend.photoCount > 0 ? t("attendance.friendsWent.photos", { count: friend.photoCount }) : "";
  const sharedGroupId = friend.sharedGroupId;

  return (
    <HStack space="md" className="items-start">
      <Avatar size="sm">
        {friend.avatarUrl ? (
          <AvatarImage source={{ uri: getAvatarUrl(friend.avatarUrl) }} alt={displayName} />
        ) : (
          <AvatarFallbackText>
            {getInitials({ fullName: friend.fullName, username: friend.username })}
          </AvatarFallbackText>
        )}
      </Avatar>
      <VStack space="xs" className="flex-1">
        <VStack
          accessible
          accessibilityLabel={[displayName, totalLabel, breakdown, tents, photosLabel]
            .filter(Boolean)
            .join(", ")}
        >
          <HStack space="sm" className="items-center justify-between">
            <Text className="flex-1 font-semibold text-typography-900" numberOfLines={1}>
              {displayName}
            </Text>
            <Text className="text-xs font-semibold text-typography-600">{totalLabel}</Text>
          </HStack>
          {breakdown.length > 0 && (
            <Text className="text-xs text-typography-600" numberOfLines={1}>
              {breakdown}
            </Text>
          )}
          {tents.length > 0 && (
            <HStack space="xs" className="items-center">
              <MapPin size={12} color={IconColors.muted} />
              <Text className="flex-1 text-xs text-typography-600" numberOfLines={1}>
                {tents}
              </Text>
            </HStack>
          )}
        </VStack>
        {friend.photoCount > 0 &&
          (sharedGroupId ? (
            <Pressable
              onPress={() => onOpenGallery(sharedGroupId)}
              className="self-start"
              accessibilityRole="button"
              accessibilityLabel={photosLabel}
              accessibilityHint={t("attendance.friendsWent.openGalleryHint")}
            >
              <PhotoStrip friend={friend} />
            </Pressable>
          ) : (
            <PhotoStrip friend={friend} />
          ))}
      </VStack>
    </HStack>
  );
}

interface FriendsWentTabContentProps {
  /** Null until the list has loaded. */
  friends: FriendWent[] | null;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  /** Opens a shared group's gallery on this day. */
  onOpenGallery: (groupId: string) => void;
}

/**
 * Friends and group-mates who logged a past day: drinks by type, tents, and
 * photos that open a shared group's gallery.
 */
export function FriendsWentTabContent({
  friends,
  isLoading,
  error,
  onRetry,
  onOpenGallery,
}: FriendsWentTabContentProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (error && !friends) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (isLoading || !friends) {
    return (
      <VStack className="items-center py-8">
        <Spinner />
      </VStack>
    );
  }

  if (friends.length === 0) {
    return (
      <VStack className="px-2 py-8">
        <Text className="text-center text-sm text-typography-500">
          {t("attendance.friendsWent.empty")}
        </Text>
      </VStack>
    );
  }

  const visibleFriends = isExpanded ? friends : friends.slice(0, COLLAPSED_COUNT);
  const hiddenCount = friends.length - visibleFriends.length;

  return (
    <VStack space="sm" className="px-2 pb-4">
      <Text className="text-base font-semibold text-typography-900">
        {t("attendance.friendsWent.count", { count: friends.length })}
      </Text>
      <VStack space="md">
        {visibleFriends.map((friend) => (
          <FriendRow key={friend.userId} friend={friend} onOpenGallery={onOpenGallery} />
        ))}
      </VStack>
      {hiddenCount > 0 && (
        <Pressable
          onPress={() => setIsExpanded(true)}
          className="items-center py-1"
          accessibilityRole="button"
        >
          <Text className="text-sm font-medium text-typography-500">
            {t("attendance.planner.moreFriends", { count: hiddenCount })}
          </Text>
        </Pressable>
      )}
    </VStack>
  );
}
