import { useTranslation } from "@prostcounter/shared/i18n";
import type { FriendRequest } from "@prostcounter/shared/schemas";
import { getInitials } from "@prostcounter/ui";
import { useCallback } from "react";

import {
  Avatar,
  AvatarFallbackText,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { getAvatarUrl } from "@/lib/utils";

interface FriendRequestCardProps {
  request: FriendRequest;
  type: "incoming" | "outgoing";
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onCancel?: (id: string) => void;
  loading?: boolean;
}

export function FriendRequestCard({
  request,
  type,
  onAccept,
  onDecline,
  onCancel,
  loading = false,
}: FriendRequestCardProps) {
  const { t } = useTranslation();

  const { profile } = request;
  const displayName = profile.fullName || profile.username || "User";
  const initials = getInitials({
    fullName: profile.fullName,
    username: profile.username,
  });

  const handleAccept = useCallback(() => {
    onAccept?.(request.id);
  }, [onAccept, request.id]);

  const handleDecline = useCallback(() => {
    onDecline?.(request.id);
  }, [onDecline, request.id]);

  const handleCancel = useCallback(() => {
    onCancel?.(request.id);
  }, [onCancel, request.id]);

  return (
    <Card variant="outline" size="md" className="bg-white">
      <VStack space="md">
        <HStack space="md" className="items-center">
          <Avatar size="md">
            {profile.avatarUrl ? (
              <AvatarImage source={{ uri: getAvatarUrl(profile.avatarUrl) }} />
            ) : (
              <AvatarFallbackText>{initials}</AvatarFallbackText>
            )}
          </Avatar>

          <VStack space="xs" className="flex-1">
            <Text className="text-base font-semibold text-typography-900">
              {displayName}
            </Text>
            {profile.username && profile.fullName && (
              <Text className="text-sm text-typography-500">
                @{profile.username}
              </Text>
            )}
          </VStack>
        </HStack>

        {type === "incoming" ? (
          <HStack space="sm" className="justify-end">
            <Button
              variant="outline"
              action="secondary"
              size="sm"
              onPress={handleDecline}
              disabled={loading}
              accessibilityLabel={t("friends.request.decline")}
            >
              <ButtonText>{t("friends.request.decline")}</ButtonText>
            </Button>
            <Button
              variant="solid"
              action="primary"
              size="sm"
              onPress={handleAccept}
              disabled={loading}
              accessibilityLabel={t("friends.request.accept")}
            >
              {loading ? (
                <ButtonSpinner color={IconColors.white} />
              ) : (
                <ButtonText>{t("friends.request.accept")}</ButtonText>
              )}
            </Button>
          </HStack>
        ) : (
          <HStack className="justify-end">
            <Button
              variant="outline"
              action="secondary"
              size="sm"
              onPress={handleCancel}
              disabled={loading}
              accessibilityLabel={t("friends.request.cancel")}
            >
              {loading ? (
                <ButtonSpinner color={Colors.gray[500]} />
              ) : (
                <ButtonText>{t("friends.request.cancel")}</ButtonText>
              )}
            </Button>
          </HStack>
        )}
      </VStack>
    </Card>
  );
}

FriendRequestCard.displayName = "FriendRequestCard";
