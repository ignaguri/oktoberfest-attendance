import { useFestival } from "@prostcounter/shared/contexts";
import { useMessageFeed } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { cn } from "@prostcounter/ui";
import { useRouter } from "expo-router";
import { MessageSquare, RefreshCw } from "lucide-react-native";
import { useCallback } from "react";
import { ActivityIndicator, View } from "react-native";

import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/lib/auth/AuthContext";
import { Colors, IconColors } from "@/lib/constants/colors";

import { MessageItem } from "./message-item";

interface MessageFeedProps {
  onRefresh?: () => void;
}

/**
 * Message feed component for the home screen
 *
 * Shows recent messages from all user's groups with:
 * - Group name badges on each message
 * - Load more button for pagination
 * - Empty state when no messages
 * - Refresh button
 */
export function MessageFeed({ onRefresh }: MessageFeedProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentFestival } = useFestival();
  const { user } = useAuth();

  const {
    messages,
    loading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isRefreshing,
    refresh,
    error,
  } = useMessageFeed(currentFestival?.id);

  const handleRefresh = useCallback(async () => {
    await refresh();
    onRefresh?.();
  }, [refresh, onRefresh]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleViewGroupMessages = useCallback(
    (groupId: string) => {
      router.push(`/groups/${groupId}/messages`);
    },
    [router],
  );

  // Loading state
  if (loading && messages.length === 0) {
    return (
      <Card variant="outline" size="md" className="bg-white">
        <VStack space="md">
          <HStack className="items-center justify-between">
            <Heading size="sm" className="text-typography-900">
              {t("groups.messages.feed.title")}
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
  if (error && messages.length === 0) {
    return null; // Silently fail - messages are supplementary
  }

  // Empty state
  if (messages.length === 0) {
    return (
      <Card variant="outline" size="md" className="bg-white">
        <VStack space="md">
          <HStack className="items-center justify-between">
            <Heading size="sm" className="text-typography-900">
              {t("groups.messages.feed.title")}
            </Heading>
          </HStack>
          <VStack className="items-center py-6">
            <MessageSquare size={40} color={IconColors.disabled} />
            <Text className="mt-2 text-center text-typography-500">
              {t("groups.messages.feed.empty")}
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
            {t("groups.messages.feed.title")}
          </Heading>
          <Pressable onPress={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? (
              <ActivityIndicator size="small" color={Colors.primary[500]} />
            ) : (
              <RefreshCw size={18} color={IconColors.muted} />
            )}
          </Pressable>
        </HStack>

        {/* Message List */}
        <VStack>
          {messages.slice(0, 5).map((message, index) => (
            <Pressable
              key={message.id}
              onPress={() => handleViewGroupMessages(message.groupId)}
            >
              <View
                className={cn(
                  index < Math.min(messages.length, 5) - 1 &&
                    "border-b border-outline-100",
                )}
              >
                <MessageItem
                  message={message}
                  currentUserId={user?.id}
                  showGroupName
                  festivalId={currentFestival?.id}
                />
              </View>
            </Pressable>
          ))}
        </VStack>

        {/* Load More / View All */}
        {(hasNextPage || messages.length > 5) && (
          <Button
            variant="outline"
            action="secondary"
            size="sm"
            className="mt-2"
            onPress={handleLoadMore}
            disabled={isFetchingNextPage}
          >
            <ButtonText>{t("groups.messages.feed.viewAll")}</ButtonText>
          </Button>
        )}
      </VStack>
    </Card>
  );
}

MessageFeed.displayName = "MessageFeed";
