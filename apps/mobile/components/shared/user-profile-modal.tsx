import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import {
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
} from "@/components/ui/modal";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";
import { useTranslation } from "@prostcounter/shared/i18n";
import { getInitials } from "@prostcounter/ui";
import { Beer, Calendar, TrendingUp, X } from "lucide-react-native";

import type { ReactNode } from "react";

export interface UserProfileData {
  username?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  stats?: {
    daysAttended: number;
    totalBeers: number;
    avgBeers: number;
  } | null;
}

interface UserProfileModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** User profile data to display (null while loading or not found) */
  profile: UserProfileData | null;
  /** Whether profile data is being loaded */
  loading?: boolean;
  /** Custom title for the modal */
  title?: string;
}

/**
 * Reusable modal for displaying user profile information
 *
 * Usage:
 * ```tsx
 * <UserProfileModal
 *   isOpen={!!selectedUserId}
 *   onClose={() => setSelectedUserId(null)}
 *   profile={publicProfile}
 *   loading={profileLoading}
 * />
 * ```
 */
export function UserProfileModal({
  isOpen,
  onClose,
  profile,
  loading = false,
  title,
}: UserProfileModalProps) {
  const { t } = useTranslation();

  const modalTitle = title || t("activityFeed.userProfile");

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalBackdrop />
      <ModalContent>
        <ModalHeader>
          <Heading size="md" className="text-typography-900">
            {modalTitle}
          </Heading>
          <ModalCloseButton>
            <X size={20} color={IconColors.default} />
          </ModalCloseButton>
        </ModalHeader>
        <ModalBody className="pb-6">
          {loading ? (
            <VStack className="items-center py-8">
              <Spinner size="large" color={Colors.primary[500]} />
              <Text className="mt-2 text-typography-500">
                {t("common.loading")}
              </Text>
            </VStack>
          ) : profile ? (
            <VStack space="md" className="items-center">
              {/* Large Avatar */}
              <Avatar size="xl">
                {profile.avatarUrl ? (
                  <AvatarImage
                    source={{ uri: getAvatarUrl(profile.avatarUrl) }}
                    alt={profile.fullName || profile.username || "User"}
                  />
                ) : (
                  <AvatarFallbackText>
                    {getInitials({
                      fullName: profile.fullName,
                      username: profile.username,
                    })}
                  </AvatarFallbackText>
                )}
              </Avatar>

              {/* User Info */}
              <VStack space="xs" className="items-center">
                {profile.username && (
                  <Text className="text-lg font-semibold text-typography-900">
                    {profile.username}
                  </Text>
                )}
                {profile.fullName && (
                  <Text className="text-sm text-typography-500">
                    {profile.fullName}
                  </Text>
                )}
              </VStack>

              {/* Stats - only shown if we have stats */}
              {profile.stats && (
                <HStack space="lg" className="mt-2">
                  <VStack className="items-center">
                    <HStack space="xs" className="items-center">
                      <Calendar size={16} color={IconColors.muted} />
                      <Text className="text-xl font-bold text-typography-900">
                        {profile.stats.daysAttended}
                      </Text>
                    </HStack>
                    <Text className="text-xs text-typography-500">
                      {t("leaderboard.stats.days")}
                    </Text>
                  </VStack>
                  <VStack className="items-center">
                    <HStack space="xs" className="items-center">
                      <Beer size={16} color={IconColors.muted} />
                      <Text className="text-xl font-bold text-typography-900">
                        {profile.stats.totalBeers}
                      </Text>
                    </HStack>
                    <Text className="text-xs text-typography-500">
                      {t("leaderboard.stats.drinks")}
                    </Text>
                  </VStack>
                  <VStack className="items-center">
                    <HStack space="xs" className="items-center">
                      <TrendingUp size={16} color={IconColors.muted} />
                      <Text className="text-xl font-bold text-typography-900">
                        {profile.stats.avgBeers.toFixed(1)}
                      </Text>
                    </HStack>
                    <Text className="text-xs text-typography-500">
                      {t("leaderboard.stats.avg")}
                    </Text>
                  </VStack>
                </HStack>
              )}
            </VStack>
          ) : (
            <VStack className="items-center py-4">
              <Text className="text-typography-500">
                {t("activityFeed.profileNotFound")}
              </Text>
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

interface TappableAvatarProps {
  /** Avatar URL */
  avatarUrl?: string | null;
  /** Username for fallback initials */
  username?: string | null;
  /** Full name for fallback initials */
  fullName?: string | null;
  /** Avatar size */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /** Callback when avatar is tapped */
  onPress: () => void;
  /** Children to render instead of default Avatar */
  children?: ReactNode;
}

/**
 * Tappable avatar that can trigger a profile modal
 *
 * Usage:
 * ```tsx
 * <TappableAvatar
 *   avatarUrl={user.avatarUrl}
 *   username={user.username}
 *   fullName={user.fullName}
 *   onPress={() => setSelectedUserId(user.id)}
 * />
 * ```
 */
export function TappableAvatar({
  avatarUrl,
  username,
  fullName,
  size = "sm",
  onPress,
  children,
}: TappableAvatarProps) {
  const { t } = useTranslation();
  const displayName = username || fullName || "User";

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={t("activityFeed.viewProfile")}
      accessibilityRole="button"
    >
      {children || (
        <Avatar size={size}>
          {avatarUrl ? (
            <AvatarImage
              source={{ uri: getAvatarUrl(avatarUrl) }}
              alt={displayName}
            />
          ) : (
            <AvatarFallbackText>
              {getInitials({ fullName, username })}
            </AvatarFallbackText>
          )}
        </Avatar>
      )}
    </Pressable>
  );
}

UserProfileModal.displayName = "UserProfileModal";
TappableAvatar.displayName = "TappableAvatar";
