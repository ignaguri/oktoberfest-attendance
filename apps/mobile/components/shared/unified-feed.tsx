import { useFestival } from "@prostcounter/shared/contexts";
import {
  type UnifiedFeedItem,
  useUnifiedFeed,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { MessageSquarePlus, Newspaper, RefreshCw } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { ComposeMessage } from "@/components/messages/compose-message";
import { MessageItem } from "@/components/messages/message-item";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/lib/auth/AuthContext";
import { Colors, IconColors } from "@/lib/constants/colors";

import { ActivityItem } from "./activity-item";

interface UnifiedFeedProps {
  onRefresh?: () => void;
}

/**
 * Unified feed combining activities and group messages in chronological order.
 *
 * Features:
 * - Compose button to post new messages from the home feed
 * - Renders different item types via switch on feedType
 * - Reuses existing ActivityItem and MessageItem renderers
 */
export function UnifiedFeed({ onRefresh }: UnifiedFeedProps) {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const { user } = useAuth();
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const {
    feedItems,
    loading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isRefreshing,
    refresh,
    error,
  } = useUnifiedFeed(currentFestival?.id);

  const handleRefresh = useCallback(async () => {
    await refresh();
    onRefresh?.();
  }, [refresh, onRefresh]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleComposeSuccess = useCallback(() => {
    refresh();
  }, [refresh]);

  // Loading state
  if (loading && feedItems.length === 0) {
    return (
      <Card variant="outline" size="md" className="bg-white">
        <VStack space="md">
          <HStack className="items-center justify-between">
            <Heading size="sm" className="text-typography-900">
              {t("home.unifiedFeed.title")}
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
  if (error && feedItems.length === 0) {
    return (
      <Card variant="outline" size="md" className="bg-white">
        <VStack space="md" className="items-center py-4">
          <Text className="text-error-600">{t("home.unifiedFeed.error")}</Text>
          <Button variant="outline" size="sm" onPress={handleRefresh}>
            <ButtonText>{t("common.actions.retry")}</ButtonText>
          </Button>
        </VStack>
      </Card>
    );
  }

  // Empty state
  if (feedItems.length === 0) {
    return (
      <Card variant="outline" size="md" className="bg-white">
        <VStack space="md">
          <HStack className="items-center justify-between">
            <Heading size="sm" className="text-typography-900">
              {t("home.unifiedFeed.title")}
            </Heading>
            <HStack space="sm">
              <Pressable
                onPress={() => setIsComposeOpen(true)}
                accessibilityLabel={t("home.unifiedFeed.compose")}
              >
                <MessageSquarePlus size={18} color={Colors.primary[500]} />
              </Pressable>
            </HStack>
          </HStack>
          <VStack className="items-center py-6">
            <Newspaper size={40} color={IconColors.disabled} />
            <Text className="mt-2 text-center text-typography-500">
              {t("home.unifiedFeed.empty")}
            </Text>
          </VStack>
        </VStack>

        {currentFestival?.id && (
          <ComposeMessage
            isOpen={isComposeOpen}
            onClose={() => setIsComposeOpen(false)}
            festivalId={currentFestival.id}
            onSuccess={handleComposeSuccess}
          />
        )}
      </Card>
    );
  }

  return (
    <Card variant="outline" size="md" className="bg-white">
      <VStack space="sm">
        {/* Header */}
        <HStack className="items-center justify-between">
          <Heading size="sm" className="text-typography-900">
            {t("home.unifiedFeed.title")}
          </Heading>
          <HStack space="sm">
            <Pressable
              onPress={() => setIsComposeOpen(true)}
              accessibilityLabel={t("home.unifiedFeed.compose")}
            >
              <MessageSquarePlus size={18} color={Colors.primary[500]} />
            </Pressable>
            <Pressable onPress={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? (
                <ActivityIndicator size="small" color={Colors.primary[500]} />
              ) : (
                <RefreshCw size={18} color={IconColors.muted} />
              )}
            </Pressable>
          </HStack>
        </HStack>

        {/* Feed Items */}
        <VStack>
          {feedItems.map((item, index) => (
            <View
              key={item.feedItemId}
              className={
                index < feedItems.length - 1
                  ? "border-b border-outline-100"
                  : ""
              }
            >
              <FeedItemRenderer
                item={item}
                festivalId={currentFestival?.id}
                currentUserId={user?.id}
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
                ? t("common.status.loading")
                : t("home.unifiedFeed.loadMore")}
            </ButtonText>
          </Button>
        )}
      </VStack>

      {/* Compose Message Sheet */}
      {currentFestival?.id && (
        <ComposeMessage
          isOpen={isComposeOpen}
          onClose={() => setIsComposeOpen(false)}
          festivalId={currentFestival.id}
          onSuccess={handleComposeSuccess}
        />
      )}
    </Card>
  );
}

UnifiedFeed.displayName = "UnifiedFeed";

// --- Feed item renderer (dispatches to the right component) ---

interface FeedItemRendererProps {
  item: UnifiedFeedItem;
  festivalId?: string;
  currentUserId?: string;
}

function FeedItemRenderer({
  item,
  festivalId,
  currentUserId,
}: FeedItemRendererProps) {
  switch (item.feedType) {
    case "activity":
      return <ActivityItem activity={item.data} festivalId={festivalId} />;
    case "message":
      return (
        <MessageItem
          message={item.data}
          currentUserId={currentUserId}
          festivalId={festivalId}
        />
      );
    default:
      return null;
  }
}
