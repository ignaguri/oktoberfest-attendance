import { useTranslation } from "@prostcounter/shared/i18n";
import type { Friend } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { getInitials } from "@prostcounter/ui";
import { parseISO } from "date-fns";
import { ChevronRight, UserX } from "lucide-react-native";
import { useCallback, useMemo } from "react";

import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

interface FriendCardProps {
  friend: Friend;
  onPress?: (friend: Friend) => void;
  onUnfriend?: (friend: Friend) => void;
}

export function FriendCard({ friend, onPress, onUnfriend }: FriendCardProps) {
  const { t } = useTranslation();

  const displayName = friend.fullName || friend.username || "User";
  const initials = getInitials({
    fullName: friend.fullName,
    username: friend.username,
  });

  const formattedFriendsSince = useMemo(() => {
    try {
      return formatLocalized(parseISO(friend.friendsSince), "MMM d, yyyy");
    } catch {
      return null;
    }
  }, [friend.friendsSince]);

  const handlePress = useCallback(() => {
    onPress?.(friend);
  }, [onPress, friend]);

  const handleUnfriend = useCallback(() => {
    onUnfriend?.(friend);
  }, [onUnfriend, friend]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={t("friends.status.friends") + ": " + displayName}
    >
      <Card variant="outline" size="md" className="bg-white">
        <HStack className="items-center justify-between">
          <HStack space="md" className="flex-1 items-center">
            <Avatar size="md">
              {friend.avatarUrl ? (
                <AvatarImage source={{ uri: getAvatarUrl(friend.avatarUrl) }} />
              ) : (
                <AvatarFallbackText>{initials}</AvatarFallbackText>
              )}
            </Avatar>

            <VStack space="xs" className="flex-1">
              <Text className="text-base font-semibold text-typography-900">
                {displayName}
              </Text>
              {friend.username && friend.fullName && (
                <Text className="text-sm text-typography-500">
                  @{friend.username}
                </Text>
              )}
              {formattedFriendsSince && (
                <Text className="text-xs text-typography-400">
                  {t("friends.friendsSince", {
                    date: formattedFriendsSince,
                  })}
                </Text>
              )}
            </VStack>
          </HStack>

          <HStack space="sm" className="items-center">
            {onUnfriend && (
              <Pressable
                onPress={handleUnfriend}
                accessibilityRole="button"
                accessibilityLabel={t("friends.unfriend")}
                accessibilityHint={t("friends.unfriendConfirm")}
                className="p-2"
              >
                <UserX size={18} color={IconColors.muted} />
              </Pressable>
            )}
            {onPress && <ChevronRight size={20} color={IconColors.muted} />}
          </HStack>
        </HStack>
      </Card>
    </Pressable>
  );
}

FriendCard.displayName = "FriendCard";
