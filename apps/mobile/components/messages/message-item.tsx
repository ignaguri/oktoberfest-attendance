import { formatRelativeTime } from "@prostcounter/shared";
import { useTranslation } from "@prostcounter/shared/i18n";
import type {
  GroupMessageFeedItem,
  GroupMessageItem,
} from "@prostcounter/shared/schemas";
import { getInitials } from "@prostcounter/ui";
import { AlertTriangle, Pin, Trash2 } from "lucide-react-native";
import { useCallback, useMemo } from "react";

import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge, BadgeText } from "@/components/ui/badge";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

interface MessageItemProps {
  message: GroupMessageItem | GroupMessageFeedItem;
  currentUserId?: string;
  showGroupName?: boolean;
  onDelete?: (messageId: string) => void;
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
}: MessageItemProps) {
  const { t } = useTranslation();
  const isOwn = currentUserId === message.userId;
  const isAlert = message.messageType === "alert";
  const isPinned = message.pinned;

  const timeAgo = useMemo(() => {
    try {
      return formatRelativeTime(new Date(message.createdAt));
    } catch {
      return "";
    }
  }, [message.createdAt]);

  const displayName = message.username || message.fullName || "Unknown";

  const handleDelete = useCallback(() => {
    onDelete?.(message.id);
  }, [onDelete, message.id]);

  const groupName =
    showGroupName && "groupName" in message
      ? (message as GroupMessageFeedItem).groupName
      : null;

  return (
    <VStack
      space="xs"
      className={`px-3 py-3 ${isAlert ? "rounded-lg bg-amber-50" : ""}`}
    >
      <HStack space="sm" className="items-start">
        {/* Avatar */}
        <Avatar size="sm">
          {message.avatarUrl ? (
            <AvatarImage
              source={{ uri: getAvatarUrl(message.avatarUrl) }}
              alt={displayName}
            />
          ) : (
            <AvatarFallbackText>
              {getInitials({
                fullName: message.fullName,
                username: message.username,
              })}
            </AvatarFallbackText>
          )}
        </Avatar>

        {/* Content */}
        <VStack className="flex-1">
          <HStack className="items-center justify-between">
            <HStack space="xs" className="flex-1 items-center">
              {isAlert && (
                <AlertTriangle size={14} color={Colors.primary[500]} />
              )}
              <Text
                className="text-sm font-semibold text-typography-900"
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {isPinned && <Pin size={12} color={IconColors.muted} />}
            </HStack>
            <Text className="text-xs text-typography-400">{timeAgo}</Text>
          </HStack>

          {/* Group name badge for feed view */}
          {groupName && (
            <Badge
              action="muted"
              variant="outline"
              size="sm"
              className="mr-auto mt-0.5"
            >
              <BadgeText className="text-xs">{groupName}</BadgeText>
            </Badge>
          )}

          {/* Message content */}
          <Text className="mt-1 text-sm text-typography-700">
            {message.content}
          </Text>

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
    </VStack>
  );
}

MessageItem.displayName = "MessageItem";
