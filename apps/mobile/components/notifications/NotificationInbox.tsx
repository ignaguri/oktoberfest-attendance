import type { Notification } from "@novu/js";
import { useCounts, useNotifications } from "@novu/react-native";
import { useTranslation } from "@prostcounter/shared/i18n";
import { formatRelativeTime } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { Archive, Bell, CheckCheck } from "lucide-react-native";
import { useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  RefreshControl,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";

import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { Colors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

interface NotificationItemProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
  onArchive: (notification: Notification) => void;
}

/**
 * Render the archive action behind the swipeable item
 */
function renderRightActions(
  _progress: Animated.AnimatedInterpolation<number>,
  dragX: Animated.AnimatedInterpolation<number>,
  label: string,
) {
  const scale = dragX.interpolate({
    inputRange: [-80, 0],
    outputRange: [1, 0.5],
    extrapolate: "clamp",
  });

  return (
    <View className="mx-3 mb-2 items-center justify-center rounded-xl bg-red-500 px-6">
      <Animated.View
        style={{ transform: [{ scale }] }}
        className="items-center"
      >
        <Archive size={20} color="white" />
        <Text className="mt-1 text-xs text-white">{label}</Text>
      </Animated.View>
    </View>
  );
}

/**
 * Single notification item component with swipe-to-archive
 */
function NotificationItem({
  notification,
  onPress,
  onArchive,
}: NotificationItemProps) {
  const { t } = useTranslation();
  const timeAgo = formatRelativeTime(new Date(notification.createdAt));
  const isRead = notification.isRead;
  const swipeableRef = useRef<Swipeable>(null);

  const handleSwipeOpen = useCallback(() => {
    swipeableRef.current?.close();
    onArchive(notification);
  }, [notification, onArchive]);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={(progress, dragX) =>
        renderRightActions(progress, dragX, t("profile.notifications.archive"))
      }
      onSwipeableOpen={handleSwipeOpen}
      overshootRight={false}
    >
      <Pressable
        onPress={() => onPress(notification)}
        className={cn(
          "mx-3 mb-2 flex-row rounded-xl p-4 shadow-sm",
          isRead ? "bg-white" : "bg-primary-50",
        )}
        accessibilityLabel={notification.subject || notification.body}
        accessibilityHint={t("profile.notifications.tapToView")}
      >
        {/* Unread indicator */}
        <View className="mr-2 justify-center">
          {!isRead ? (
            <View className="h-2 w-2 rounded-full bg-primary-500" />
          ) : (
            <View className="h-2 w-2" />
          )}
        </View>

        {/* Avatar */}
        {notification.avatar && (
          <Image
            source={{ uri: getAvatarUrl(notification.avatar) }}
            className="mr-3 h-10 w-10 rounded-full"
            alt=""
          />
        )}

        {/* Content */}
        <View className="flex-1">
          {notification.subject && (
            <Text className="mb-1 font-semibold text-typography-900">
              {notification.subject}
            </Text>
          )}
          <Text
            className="text-sm text-typography-700"
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {notification.body}
          </Text>
          <Text className="mt-1 text-xs text-typography-400">{timeAgo}</Text>
        </View>
      </Pressable>
    </Swipeable>
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
      <Text className="mt-4 text-center text-typography-500">
        {t("profile.notifications.empty")}
      </Text>
      <Text className="mt-2 text-center text-sm text-typography-400">
        {t("profile.notifications.emptyHint")}
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
 * Supports swipe-to-archive on individual notifications.
 *
 * Must be used within a NovuProviderWrapper.
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
      // Mark as read when tapped
      if (!notification.isRead) {
        await notification.read();
      }
      onNotificationPress?.(notification);
    },
    [onNotificationPress],
  );

  const handleArchive = useCallback(async (notification: Notification) => {
    await notification.archive();
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationItem
        notification={item}
        onPress={handleNotificationPress}
        onArchive={handleArchive}
      />
    ),
    [handleNotificationPress, handleArchive],
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
    <View className="flex-1">
      {/* Header with mark all as read */}
      {unreadCount > 0 && (
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-sm text-typography-600">
            {t("profile.notifications.unreadCount", {
              count: unreadCount,
            })}
          </Text>
          <Pressable
            onPress={handleMarkAllAsRead}
            className="flex-row items-center gap-1"
            accessibilityLabel={t("profile.notifications.markAllRead")}
          >
            <CheckCheck size={16} color={Colors.primary[500]} />
            <Text className="text-sm text-primary-500">
              {t("profile.notifications.markAllRead")}
            </Text>
          </Pressable>
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
          notifications?.length === 0
            ? { flexGrow: 1 }
            : { paddingTop: 4, paddingBottom: 16 }
        }
      />
    </View>
  );
}
