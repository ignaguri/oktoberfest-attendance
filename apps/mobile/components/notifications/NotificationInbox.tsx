import { Text } from "@/components/ui/text";
import { Colors } from "@/lib/constants/colors";
import { useNotifications, useCounts } from "@novu/react-native";
import { useTranslation } from "@prostcounter/shared/i18n";
import { formatRelativeTime } from "@prostcounter/shared/utils";
import { Bell, CheckCheck } from "lucide-react-native";
import { useCallback } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";

import type { Notification } from "@novu/js";

interface NotificationItemProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
}

/**
 * Single notification item component
 */
function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const timeAgo = formatRelativeTime(new Date(notification.createdAt));
  const isRead = notification.isRead;

  return (
    <TouchableOpacity
      onPress={() => onPress(notification)}
      className={`border-outline-100 flex-row border-b p-4 ${
        isRead ? "bg-white" : "bg-primary-50"
      }`}
      accessibilityLabel={notification.subject || notification.body}
      accessibilityHint="Tap to view notification details"
    >
      {/* Unread indicator */}
      <View className="mr-3 justify-center">
        {!isRead ? (
          <View className="bg-primary-500 h-2 w-2 rounded-full" />
        ) : (
          <View className="h-2 w-2" />
        )}
      </View>

      {/* Content */}
      <View className="flex-1">
        {notification.subject && (
          <Text className="text-typography-900 mb-1 font-semibold">
            {notification.subject}
          </Text>
        )}
        <Text
          className="text-typography-700 text-sm"
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {notification.body}
        </Text>
        <Text className="text-typography-400 mt-1 text-xs">{timeAgo}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Empty state when no notifications
 */
function EmptyState() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center p-8">
      <Bell size={48} color={Colors.primary[500]} style={{ opacity: 0.4 }} />
      <Text className="text-typography-500 mt-4 text-center">
        {t("profile.notifications.empty", {
          defaultValue: "No notifications yet",
        })}
      </Text>
      <Text className="text-typography-400 mt-2 text-center text-sm">
        {t("profile.notifications.emptyHint", {
          defaultValue: "Your notifications will appear here",
        })}
      </Text>
    </View>
  );
}

interface NotificationInboxProps {
  onNotificationPress?: (notification: Notification) => void;
}

/**
 * Notification Inbox Component
 *
 * Displays a list of notifications from Novu.
 * Uses the @novu/react-native hooks for data fetching.
 *
 * Must be used within a NovuProviderWrapper.
 *
 * Usage:
 * ```tsx
 * <NovuProviderWrapper>
 *   <NotificationInbox onNotificationPress={(n) => console.log(n.id)} />
 * </NovuProviderWrapper>
 * ```
 */
export function NotificationInbox({
  onNotificationPress,
}: NotificationInboxProps) {
  const { t } = useTranslation();

  const {
    notifications,
    isLoading,
    isFetching,
    hasMore,
    fetchMore,
    readAll,
    refetch,
  } = useNotifications();

  // Get unread count
  const { counts } = useCounts({
    filters: [{ read: false }],
  });
  const unreadCount = counts?.[0]?.count ?? 0;

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isFetching) {
      fetchMore();
    }
  }, [hasMore, isFetching, fetchMore]);

  const handleMarkAllAsRead = useCallback(async () => {
    await readAll();
  }, [readAll]);

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      // Mark as read when tapped (Notification object has read method)
      if (!notification.isRead) {
        await notification.read();
      }

      // Call the external handler if provided
      onNotificationPress?.(notification);
    },
    [onNotificationPress],
  );

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationItem notification={item} onPress={handleNotificationPress} />
    ),
    [handleNotificationPress],
  );

  const renderFooter = useCallback(() => {
    if (!isFetching || isLoading) return null;
    return (
      <View className="py-4">
        <ActivityIndicator size="small" color={Colors.primary[500]} />
      </View>
    );
  }, [isFetching, isLoading]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      {/* Header with mark all as read */}
      {unreadCount > 0 && (
        <View className="border-outline-100 flex-row items-center justify-between border-b px-4 py-3">
          <Text className="text-typography-600 text-sm">
            {t("profile.notifications.unreadCount", {
              defaultValue: "{{count}} unread",
              count: unreadCount,
            })}
          </Text>
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            className="flex-row items-center gap-1"
            accessibilityLabel="Mark all as read"
          >
            <CheckCheck size={16} color={Colors.primary[500]} />
            <Text className="text-primary-500 text-sm">
              {t("profile.notifications.markAllRead", {
                defaultValue: "Mark all read",
              })}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notification list */}
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={EmptyState}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={Colors.primary[500]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={
          notifications?.length === 0 ? { flex: 1 } : undefined
        }
      />
    </View>
  );
}
