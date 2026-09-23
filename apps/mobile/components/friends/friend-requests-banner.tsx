import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useFriendRequests,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { FriendRequest } from "@prostcounter/shared/schemas";
import { useRouter } from "expo-router";
import { UserPlus } from "lucide-react-native";
import { useCallback } from "react";

import { FriendRequestCard } from "@/components/friends/friend-request-card";
import { useNotificationAsk } from "@/components/notifications/NotificationAskProvider";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

/** More than this and the rest wait behind "See all", so Home stays short */
const MAX_VISIBLE_REQUESTS = 1;

/**
 * Incoming friend requests on Home, answerable in place. Renders nothing when
 * there are none, so Home can mount it unconditionally.
 */
export function FriendRequestsBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data } = useFriendRequests();
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const { ask } = useNotificationAsk();

  const handleAccept = useCallback(
    (requestId: string) => {
      // No error UI, same as the friends screen; the catch only keeps a failed
      // request from becoming an unhandled rejection.
      acceptRequest
        .mutate(requestId)
        .then(() => ask("friend_request"))
        .catch(() => {});
    },
    [acceptRequest, ask],
  );

  const handleDecline = useCallback(
    (requestId: string) => {
      declineRequest.mutate(requestId).catch(() => {});
    },
    [declineRequest],
  );

  const requests = (data as FriendRequest[] | undefined) ?? [];
  if (requests.length === 0) {
    return null;
  }

  return (
    <VStack space="sm">
      <HStack className="items-center justify-between">
        <HStack space="sm" className="items-center">
          <UserPlus size={18} color={IconColors.primary} />
          <Text className="text-base font-semibold text-typography-900">
            {t("friends.homeBanner.title", { count: requests.length })}
          </Text>
        </HStack>
        {requests.length > MAX_VISIBLE_REQUESTS && (
          <Pressable
            onPress={() => router.push("/friends?tab=requests")}
            accessibilityRole="link"
            accessibilityLabel={t("friends.homeBanner.seeAll")}
            accessibilityHint={t("friends.entryHint")}
          >
            <Text className="text-sm font-medium text-primary-600">
              {t("friends.homeBanner.seeAll")}
            </Text>
          </Pressable>
        )}
      </HStack>
      {requests.slice(0, MAX_VISIBLE_REQUESTS).map((request) => (
        <FriendRequestCard
          key={request.id}
          request={request}
          type="incoming"
          onAccept={handleAccept}
          onDecline={handleDecline}
          loading={acceptRequest.loading || declineRequest.loading}
        />
      ))}
    </VStack>
  );
}
