import { usePublicProfile } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { Friend } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { parseISO } from "date-fns";
import { UserX } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

import {
  TappableAvatar,
  UserProfileModal,
} from "@/components/shared/user-profile-modal";

interface FriendCardProps {
  friend: Friend;
  festivalId?: string;
  onUnfriend?: (friend: Friend) => void;
}

export function FriendCard({
  friend,
  festivalId,
  onUnfriend,
}: FriendCardProps) {
  const { t } = useTranslation();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: publicProfile, loading: profileLoading } = usePublicProfile(
    selectedUserId ?? undefined,
    festivalId,
  );

  const displayName = friend.fullName || friend.username || "User";

  const formattedFriendsSince = useMemo(() => {
    try {
      return formatLocalized(parseISO(friend.friendsSince), "MMM d, yyyy");
    } catch {
      return null;
    }
  }, [friend.friendsSince]);

  const handleAvatarPress = useCallback(() => {
    setSelectedUserId(friend.id);
  }, [friend.id]);

  const handleCloseProfileModal = useCallback(() => {
    setSelectedUserId(null);
  }, []);

  const handleUnfriend = useCallback(() => {
    onUnfriend?.(friend);
  }, [onUnfriend, friend]);

  return (
    <>
      <Card variant="outline" size="md" className="bg-white">
        <HStack className="items-center justify-between">
          <HStack space="md" className="flex-1 items-center">
            <TappableAvatar
              avatarUrl={friend.avatarUrl}
              username={friend.username}
              fullName={friend.fullName}
              size="md"
              onPress={handleAvatarPress}
            />

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
          </HStack>
        </HStack>
      </Card>

      <UserProfileModal
        isOpen={!!selectedUserId}
        onClose={handleCloseProfileModal}
        profile={publicProfile}
        loading={profileLoading}
      />
    </>
  );
}

FriendCard.displayName = "FriendCard";
