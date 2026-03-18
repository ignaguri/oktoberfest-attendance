import { useFestival } from "@prostcounter/shared/contexts";
import {
  useAcceptFriendRequest,
  useCancelFriendRequest,
  useDeclineFriendRequest,
  useFriendRequestCount,
  useFriendRequests,
  useFriends,
  useFriendSuggestions,
  useOutgoingFriendRequests,
  useSendFriendRequest,
  useUnfriend,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type {
  Friend,
  FriendRequest,
  FriendSuggestion,
} from "@prostcounter/shared/schemas";
import { getInitials } from "@prostcounter/ui";
import { useRouter } from "expo-router";
import { Search, UserPlus, Users, UserX } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FriendCard } from "@/components/friends/friend-card";
import { FriendRequestCard } from "@/components/friends/friend-request-card";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  useAlertDialog,
} from "@/components/ui/alert-dialog";
import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

type TabType = "friends" | "requests";

export default function FriendsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { currentFestival } = useFestival();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("friends");

  // Alert dialog for unfriend confirmation
  const { dialog, showDialog, closeDialog } = useAlertDialog();

  // Data hooks
  const {
    data: friends,
    loading: friendsLoading,
    refetch: refetchFriends,
  } = useFriends();
  const {
    data: suggestions,
    loading: suggestionsLoading,
    refetch: refetchSuggestions,
  } = useFriendSuggestions();
  const {
    data: incomingRequests,
    loading: incomingLoading,
    refetch: refetchIncoming,
  } = useFriendRequests();
  const {
    data: outgoingRequests,
    loading: outgoingLoading,
    refetch: refetchOutgoing,
  } = useOutgoingFriendRequests();
  const { data: requestCount } = useFriendRequestCount();

  // Mutation hooks
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const cancelRequest = useCancelFriendRequest();
  const unfriendMutation = useUnfriend();

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchFriends(),
        refetchSuggestions(),
        refetchIncoming(),
        refetchOutgoing(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchFriends, refetchSuggestions, refetchIncoming, refetchOutgoing]);

  // Handlers
  const handleSendRequest = useCallback(
    (userId: string) => {
      sendRequest.mutate(userId);
    },
    [sendRequest],
  );

  const handleAcceptRequest = useCallback(
    (requestId: string) => {
      acceptRequest.mutate(requestId);
    },
    [acceptRequest],
  );

  const handleDeclineRequest = useCallback(
    (requestId: string) => {
      declineRequest.mutate(requestId);
    },
    [declineRequest],
  );

  const handleCancelRequest = useCallback(
    (requestId: string) => {
      cancelRequest.mutate(requestId);
    },
    [cancelRequest],
  );

  const handleUnfriendPress = useCallback(
    (friend: Friend) => {
      const displayName = friend.fullName || friend.username || "User";
      showDialog(
        t("friends.unfriend"),
        t("friends.unfriendConfirm", { name: displayName }),
        "destructive",
        () => {
          unfriendMutation.mutate(friend.id);
        },
      );
    },
    [showDialog, t, unfriendMutation],
  );

  // Derived values
  const pendingCount = requestCount ?? 0;

  const isMyFriendsLoading = friendsLoading || suggestionsLoading;
  const isRequestsLoading = incomingLoading || outgoingLoading;

  // Tab label with count
  const requestsTabLabel = useMemo(() => {
    if (pendingCount > 0) {
      return t("friends.requestsCount", { count: pendingCount });
    }
    return t("friends.requests");
  }, [t, pendingCount]);

  return (
    <SafeAreaView className="flex-1 bg-background-50" edges={[]}>
      {/* Header */}
      <HStack className="items-center justify-between px-4 pb-2 pt-3">
        <Text className="text-2xl font-bold text-typography-900">
          {t("friends.title")}
        </Text>
        <Pressable
          onPress={() => router.push("/friends/search")}
          className="rounded-full p-2"
          accessibilityRole="button"
          accessibilityLabel={t("friends.search.placeholder")}
        >
          <Search size={24} color={IconColors.default} />
        </Pressable>
      </HStack>

      {/* Segmented tabs */}
      <HStack space="sm" className="mx-4 mb-3 rounded-xl bg-background-100 p-1">
        <Pressable
          onPress={() => setActiveTab("friends")}
          className={
            activeTab === "friends"
              ? "flex-1 rounded-lg bg-white px-4 py-2 shadow-sm"
              : "flex-1 rounded-lg px-4 py-2"
          }
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "friends" }}
          accessibilityLabel={t("friends.myFriends")}
        >
          <Text
            className={
              activeTab === "friends"
                ? "text-center text-sm font-semibold text-typography-900"
                : "text-center text-sm font-medium text-typography-500"
            }
          >
            {t("friends.myFriends")}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab("requests")}
          className={
            activeTab === "requests"
              ? "flex-1 rounded-lg bg-white px-4 py-2 shadow-sm"
              : "flex-1 rounded-lg px-4 py-2"
          }
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === "requests" }}
          accessibilityLabel={requestsTabLabel}
        >
          <HStack space="xs" className="items-center justify-center">
            <Text
              className={
                activeTab === "requests"
                  ? "text-center text-sm font-semibold text-typography-900"
                  : "text-center text-sm font-medium text-typography-500"
              }
            >
              {requestsTabLabel}
            </Text>
            {pendingCount > 0 && activeTab !== "requests" && (
              <View className="h-2 w-2 rounded-full bg-primary-500" />
            )}
          </HStack>
        </Pressable>
      </HStack>

      {/* Tab content */}
      {activeTab === "friends" ? (
        <MyFriendsTab
          friends={friends ?? []}
          suggestions={suggestions ?? []}
          isLoading={isMyFriendsLoading}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onSendRequest={handleSendRequest}
          sendRequestLoading={sendRequest.loading}
          onUnfriend={handleUnfriendPress}
          festivalId={currentFestival?.id}
        />
      ) : (
        <RequestsTab
          incomingRequests={incomingRequests ?? []}
          outgoingRequests={outgoingRequests ?? []}
          isLoading={isRequestsLoading}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onAccept={handleAcceptRequest}
          onDecline={handleDeclineRequest}
          onCancel={handleCancelRequest}
          acceptLoading={acceptRequest.loading}
          declineLoading={declineRequest.loading}
          cancelLoading={cancelRequest.loading}
        />
      )}

      {/* Unfriend confirmation dialog */}
      <AlertDialog isOpen={dialog.isOpen} onClose={closeDialog}>
        <AlertDialogBackdrop />
        <AlertDialogContent>
          <AlertDialogHeader>
            <Heading size="lg">{dialog.title}</Heading>
          </AlertDialogHeader>
          <AlertDialogBody className="mb-4 mt-3">
            <Text className="text-typography-700">{dialog.message}</Text>
          </AlertDialogBody>
          <AlertDialogFooter>
            <Button variant="outline" action="secondary" onPress={closeDialog}>
              <ButtonText>{t("common.buttons.cancel")}</ButtonText>
            </Button>
            <Button
              action="negative"
              onPress={() => {
                dialog.onConfirm?.();
                closeDialog();
              }}
            >
              {unfriendMutation.loading ? (
                <ButtonSpinner color={IconColors.white} />
              ) : (
                <ButtonText>{t("friends.unfriend")}</ButtonText>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SafeAreaView>
  );
}

// ─── My Friends Tab ──────────────────────────────────────────────────────────

interface MyFriendsTabProps {
  friends: Friend[];
  suggestions: FriendSuggestion[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onSendRequest: (userId: string) => void;
  sendRequestLoading: boolean;
  onUnfriend: (friend: Friend) => void;
  festivalId?: string;
}

function MyFriendsTab({
  friends,
  suggestions,
  isLoading,
  isRefreshing,
  onRefresh,
  onSendRequest,
  sendRequestLoading,
  onUnfriend,
  festivalId,
}: MyFriendsTabProps) {
  const { t } = useTranslation();

  if (isLoading && !isRefreshing) {
    return (
      <View className="flex-1 items-center justify-center">
        <Spinner size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <View className="px-4 py-1">
      <FriendCard
        friend={item}
        festivalId={festivalId}
        onUnfriend={onUnfriend}
      />
    </View>
  );

  const renderHeader = () => (
    <>
      {/* Suggestions section */}
      {suggestions.length > 0 && (
        <VStack space="sm" className="mb-3">
          <Text className="px-4 text-base font-semibold text-typography-700">
            {t("friends.suggestions.title")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4 gap-3"
          >
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onAdd={onSendRequest}
                loading={sendRequestLoading}
              />
            ))}
          </ScrollView>
        </VStack>
      )}

      {/* Friends list header */}
      {friends.length > 0 && (
        <Text className="mb-1 px-4 text-base font-semibold text-typography-700">
          {t("friends.myFriends")}
        </Text>
      )}
    </>
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <VStack space="md" className="items-center px-8 pt-16">
        <Users size={56} color={Colors.gray[300]} />
        <Text className="text-center text-base text-typography-500">
          {t("friends.empty")}
        </Text>
        <Button
          variant="solid"
          action="primary"
          onPress={() => {}}
          accessibilityLabel={t("friends.search.placeholder")}
        >
          <Search size={16} color={IconColors.white} />
          <ButtonText>{t("friends.search.placeholder")}</ButtonText>
        </Button>
      </VStack>
    );
  };

  return (
    <FlatList
      data={friends}
      keyExtractor={(item) => item.friendshipId}
      renderItem={renderFriendItem}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary[500]}
          colors={[Colors.primary[500]]}
        />
      }
    />
  );
}

// ─── Suggestion Card ─────────────────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: FriendSuggestion;
  onAdd: (userId: string) => void;
  loading: boolean;
}

function SuggestionCard({ suggestion, onAdd, loading }: SuggestionCardProps) {
  const { t } = useTranslation();

  const displayName = suggestion.fullName || suggestion.username || "User";
  const initials = getInitials({
    fullName: suggestion.fullName,
    username: suggestion.username,
  });

  const sharedGroupsText = useMemo(() => {
    if (suggestion.sharedGroups <= 0) return null;
    if (suggestion.sharedGroups === 1) {
      return t("friends.suggestions.sharedGroups", {
        count: suggestion.sharedGroups,
      });
    }
    return t("friends.suggestions.sharedGroupsPlural", {
      count: suggestion.sharedGroups,
    });
  }, [t, suggestion.sharedGroups]);

  const handleAdd = useCallback(() => {
    onAdd(suggestion.id);
  }, [onAdd, suggestion.id]);

  return (
    <VStack
      space="sm"
      className="w-32 items-center rounded-2xl bg-white p-3 shadow-sm"
    >
      <Avatar size="lg">
        {suggestion.avatarUrl ? (
          <AvatarImage source={{ uri: getAvatarUrl(suggestion.avatarUrl) }} />
        ) : (
          <AvatarFallbackText>{initials}</AvatarFallbackText>
        )}
      </Avatar>

      <VStack space="xs" className="items-center">
        <Text
          className="text-center text-sm font-semibold text-typography-900"
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {sharedGroupsText && (
          <Text
            className="text-center text-xs text-typography-500"
            numberOfLines={1}
          >
            {sharedGroupsText}
          </Text>
        )}
      </VStack>

      <Button
        variant="solid"
        action="primary"
        size="xs"
        onPress={handleAdd}
        disabled={loading}
        accessibilityLabel={t("friends.request.send")}
      >
        {loading ? (
          <ButtonSpinner color={IconColors.white} />
        ) : (
          <>
            <UserPlus size={12} color={IconColors.white} />
            <ButtonText>{t("friends.request.send")}</ButtonText>
          </>
        )}
      </Button>
    </VStack>
  );
}

// ─── Requests Tab ────────────────────────────────────────────────────────────

interface RequestsTabProps {
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  isLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onCancel: (id: string) => void;
  acceptLoading: boolean;
  declineLoading: boolean;
  cancelLoading: boolean;
}

function RequestsTab({
  incomingRequests,
  outgoingRequests,
  isLoading,
  isRefreshing,
  onRefresh,
  onAccept,
  onDecline,
  onCancel,
  acceptLoading,
  declineLoading,
  cancelLoading,
}: RequestsTabProps) {
  const { t } = useTranslation();

  if (isLoading && !isRefreshing) {
    return (
      <View className="flex-1 items-center justify-center">
        <Spinner size="large" color={Colors.primary[500]} />
      </View>
    );
  }

  const isEmpty =
    incomingRequests.length === 0 && outgoingRequests.length === 0;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary[500]}
          colors={[Colors.primary[500]]}
        />
      }
    >
      {isEmpty ? (
        <VStack space="md" className="items-center px-8 pt-16">
          <UserX size={56} color={Colors.gray[300]} />
          <Text className="text-center text-base text-typography-500">
            {t("friends.requestsEmpty")}
          </Text>
        </VStack>
      ) : (
        <VStack space="lg" className="px-4 pt-2">
          {/* Incoming requests */}
          {incomingRequests.length > 0 && (
            <VStack space="sm">
              <Text className="text-base font-semibold text-typography-700">
                {t("friends.requests")}
              </Text>
              {incomingRequests.map((request) => (
                <FriendRequestCard
                  key={request.id}
                  request={request}
                  type="incoming"
                  onAccept={onAccept}
                  onDecline={onDecline}
                  loading={acceptLoading || declineLoading}
                />
              ))}
            </VStack>
          )}

          {/* Outgoing requests */}
          {outgoingRequests.length > 0 && (
            <VStack space="sm">
              <Text className="text-base font-semibold text-typography-700">
                {t("friends.request.sent")}
              </Text>
              {outgoingRequests.map((request) => (
                <FriendRequestCard
                  key={request.id}
                  request={request}
                  type="outgoing"
                  onCancel={onCancel}
                  loading={cancelLoading}
                />
              ))}
            </VStack>
          )}
        </VStack>
      )}
    </ScrollView>
  );
}
