import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { useFestival } from "@/lib/festival/FestivalContext";
import { useActivityFeedItems } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Newspaper, RefreshCw } from "lucide-react-native";
import { useCallback } from "react";
import { ActivityIndicator, View } from "react-native";

import { ActivityItem } from "./activity-item";

interface ActivityFeedProps {
  /** Optional callback when refresh is triggered (for parent pull-to-refresh) */
  onRefresh?: () => void;
}

/**
 * Activity feed showing recent festival activity from all users
 *
 * Features:
 * - Loading skeleton on initial load
 * - Load More button for pagination
 * - Empty state when no activities
 * - Pull-to-refresh support
 */
export function ActivityFeed({ onRefresh }: ActivityFeedProps) {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();

  const {
    activities,
    loading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isRefreshing,
    refresh,
    error,
  } = useActivityFeedItems(currentFestival?.id);

  const handleRefresh = useCallback(async () => {
    await refresh();
    onRefresh?.();
  }, [refresh, onRefresh]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Loading state
  if (loading && activities.length === 0) {
    return (
      <Card variant="outline" size="md" className="bg-white">
        <VStack space="md">
          <HStack className="items-center justify-between">
            <Heading size="sm" className="text-typography-900">
              {t("home.activityFeed.title", { defaultValue: "Activity Feed" })}
            </Heading>
          </HStack>
          <VStack space="sm" className="py-4">
            {[1, 2, 3].map((i) => (
              <HStack key={i} space="sm" className="items-center">
                <View className="h-8 w-8 rounded-full bg-background-200" />
                <VStack className="flex-1" space="xs">
                  <View className="h-4 w-32 rounded bg-background-200" />
                  <View className="h-3 w-48 rounded bg-background-100" />
                </VStack>
              </HStack>
            ))}
          </VStack>
        </VStack>
      </Card>
    );
  }

  // Error state
  if (error && activities.length === 0) {
    return (
      <Card variant="outline" size="md" className="bg-white">
        <VStack space="md" className="items-center py-4">
          <Text className="text-error-600">
            {t("home.activityFeed.error", {
              defaultValue: "Failed to load activity",
            })}
          </Text>
          <Button variant="outline" size="sm" onPress={handleRefresh}>
            <ButtonText>
              {t("common.actions.retry", { defaultValue: "Retry" })}
            </ButtonText>
          </Button>
        </VStack>
      </Card>
    );
  }

  // Empty state
  if (activities.length === 0) {
    return (
      <Card variant="outline" size="md" className="bg-white">
        <VStack space="md">
          <HStack className="items-center justify-between">
            <Heading size="sm" className="text-typography-900">
              {t("home.activityFeed.title", { defaultValue: "Activity Feed" })}
            </Heading>
          </HStack>
          <VStack className="items-center py-6">
            <Newspaper size={40} color={IconColors.disabled} />
            <Text className="mt-2 text-center text-typography-500">
              {t("home.activityFeed.empty", {
                defaultValue: "No activity yet. Be the first to log a beer!",
              })}
            </Text>
          </VStack>
        </VStack>
      </Card>
    );
  }

  return (
    <Card variant="outline" size="md" className="bg-white">
      <VStack space="sm">
        {/* Header */}
        <HStack className="items-center justify-between">
          <Heading size="sm" className="text-typography-900">
            {t("home.activityFeed.title", { defaultValue: "Activity Feed" })}
          </Heading>
          <Pressable onPress={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color={Colors.primary[500]} />
            ) : (
              <RefreshCw size={18} color={IconColors.muted} />
            )}
          </Pressable>
        </HStack>

        {/* Activity List */}
        <VStack>
          {activities.map((activity, index) => (
            <View
              key={`${activity.user_id}-${activity.activity_time}-${index}`}
              className={
                index < activities.length - 1
                  ? "border-b border-outline-100"
                  : ""
              }
            >
              <ActivityItem
                activity={activity}
                festivalId={currentFestival?.id}
              />
            </View>
          ))}
        </VStack>

        {/* Load More Button */}
        {hasNextPage && (
          <Button
            variant="outline"
            action="secondary"
            size="sm"
            className="mt-2"
            onPress={handleLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage && <ButtonSpinner color={Colors.gray[500]} />}
            <ButtonText>
              {isFetchingNextPage
                ? t("common.status.loading", { defaultValue: "Loading..." })
                : t("home.activityFeed.loadMore", {
                    defaultValue: "Load More",
                  })}
            </ButtonText>
          </Button>
        )}
      </VStack>
    </Card>
  );
}

ActivityFeed.displayName = "ActivityFeed";
