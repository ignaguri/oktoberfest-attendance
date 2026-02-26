import { formatRelativeTime } from "@prostcounter/shared";
import { usePublicProfile } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type {
  GroupMessageFeedItem,
  GroupMessageItem,
} from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";
import { AlertTriangle, Pin, Trash2 } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";

import {
  TappableAvatar,
  UserProfileModal,
} from "@/components/shared/user-profile-modal";
import { Badge, BadgeText } from "@/components/ui/badge";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

interface MessageItemProps {
  message: GroupMessageItem | GroupMessageFeedItem;
  currentUserId?: string;
  showGroupName?: boolean;
  onDelete?: (messageId: string) => void;
  festivalId?: string;
}

/**
 * Single message item for the message feed/board
 *
 * Features:
 * - User avatar with fallback
 * - Message content with timestamp
 * - Alert styling for alert-type messages
 * - Pin indicator for pinned messages
 * - Group name badge for cross-group feed
 * - Delete action for own messages
 */
export function MessageItem({
  message,
  currentUserId,
  showGroupName = false,
  onDelete,
  festivalId,
}: MessageItemProps) {
  const { t } = useTranslation();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const isOwn = currentUserId === message.userId;
  const isAlert = message.messageType === "alert";
  const isPinned = message.pinned;

  // Fetch public profile on demand when avatar is tapped
  const { data: publicProfile, loading: profileLoading } = usePublicProfile(
    selectedUserId ?? undefined,
    festivalId,
  );

  const timeAgo = useMemo(() => {
    try {
      return formatRelativeTime(new Date(message.createdAt));
    } catch {
      return "";
    }
  }, [message.createdAt]);

  const displayName =
    message.username || message.fullName || t("common.unknown");

  const handleDelete = useCallback(() => {
    onDelete?.(message.id);
  }, [onDelete, message.id]);

  const handleAvatarPress = useCallback(() => {
    setSelectedUserId(message.userId);
  }, [message.userId]);

  const handleCloseProfileModal = useCallback(() => {
    setSelectedUserId(null);
  }, []);

  const groupName =
    showGroupName && "groupName" in message
      ? (message as GroupMessageFeedItem).groupName
      : null;

  return (
    <>
      <HStack
        space="sm"
        className={cn("py-3", isAlert && "rounded-lg bg-amber-50 px-3")}
      >
        {/* Avatar - Tappable to show profile */}
        <TappableAvatar
          avatarUrl={message.avatarUrl}
          username={message.username}
          fullName={message.fullName}
          onPress={handleAvatarPress}
        />

        {/* Content */}
        <VStack className="flex-1">
          <HStack className="items-center justify-between">
            <HStack space="xs" className="flex-1 items-center">
              <Text
                className="text-sm font-medium text-typography-900"
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {/* Group name badge inline with username */}
              {groupName && (
                <Badge action="muted" variant="outline" size="sm">
                  <BadgeText className="text-xs">{groupName}</BadgeText>
                </Badge>
              )}
              {isAlert && (
                <AlertTriangle size={14} color={Colors.primary[500]} />
              )}
              {isPinned && <Pin size={12} color={IconColors.muted} />}
            </HStack>
            <Text className="text-xs text-typography-400">{timeAgo}</Text>
          </HStack>

          {/* Message content */}
          <Text className="text-sm text-typography-500">{message.content}</Text>

          {/* Alert badge */}
          {isAlert && (
            <Badge
              action="warning"
              variant="solid"
              size="sm"
              className="mr-auto mt-1 bg-primary-500"
            >
              <BadgeText className="text-xs text-white">
                {t("groups.messages.item.alert")}
              </BadgeText>
            </Badge>
          )}
        </VStack>

        {/* Delete button for own messages */}
        {isOwn && onDelete && (
          <Pressable
            onPress={handleDelete}
            className="mt-1 p-1"
            accessibilityLabel={t("common.buttons.delete")}
          >
            <Trash2 size={16} color={IconColors.muted} />
          </Pressable>
        )}
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

MessageItem.displayName = "MessageItem";
