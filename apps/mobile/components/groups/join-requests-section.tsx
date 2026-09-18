import {
  useAcceptJoinRequest,
  useDeclineJoinRequest,
  useIncomingJoinRequests,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { GroupJoinRequest } from "@prostcounter/shared/schemas";
import { getInitials } from "@prostcounter/ui";
import { UserPlus } from "lucide-react-native";
import { useCallback } from "react";

import { Avatar, AvatarFallbackText, AvatarImage } from "@/components/ui/avatar";
import type { useAlertDialog } from "@/components/ui/alert-dialog";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { logger } from "@/lib/logger";
import { getAvatarUrl } from "@/lib/utils";

type ShowDialog = ReturnType<typeof useAlertDialog>["showDialog"];

interface JoinRequestsSectionProps {
  groupId: string;
  /** The settings screen's dialog, so decline confirmation and errors share it */
  showDialog: ShowDialog;
}

function displayNameOf(request: GroupJoinRequest): string {
  return request.requester.fullName || request.requester.username || "User";
}

/**
 * Pending requests to join this group, for its creator. Renders nothing when
 * there are none.
 */
export function JoinRequestsSection({ groupId, showDialog }: JoinRequestsSectionProps) {
  const { t } = useTranslation();
  const { data } = useIncomingJoinRequests();
  const acceptJoinRequest = useAcceptJoinRequest();
  const declineJoinRequest = useDeclineJoinRequest();

  const requests = ((data as GroupJoinRequest[] | undefined) ?? []).filter(
    (request) => request.groupId === groupId,
  );

  const handleAccept = useCallback(
    async (request: GroupJoinRequest) => {
      try {
        await acceptJoinRequest.mutateAsync(request.id);
      } catch (error) {
        logger.error("Failed to accept join request:", error);
        showDialog(t("common.status.error"), t("groups.joinRequests.acceptFailed"), "destructive");
      }
    },
    [acceptJoinRequest, showDialog, t],
  );

  const handleDecline = useCallback(
    (request: GroupJoinRequest) => {
      const name = displayNameOf(request);
      showDialog(
        t("groups.joinRequests.declineTitle"),
        t("groups.joinRequests.declineMessage", { name }),
        "destructive",
        async () => {
          try {
            await declineJoinRequest.mutateAsync(request.id);
          } catch (error) {
            logger.error("Failed to decline join request:", error);
            showDialog(
              t("common.status.error"),
              t("groups.joinRequests.declineFailed"),
              "destructive",
            );
          }
        },
      );
    },
    [declineJoinRequest, showDialog, t],
  );

  if (requests.length === 0) {
    return null;
  }

  const isBusy = acceptJoinRequest.loading || declineJoinRequest.loading;

  return (
    <Card variant="outline" size="md" className="bg-background-0">
      <VStack space="md">
        <HStack space="sm" className="items-center">
          <UserPlus size={20} color={IconColors.primary} />
          <Text className="text-base font-semibold text-typography-900">
            {t("groups.joinRequests.sectionTitle")}
          </Text>
        </HStack>

        {requests.map((request) => {
          const name = displayNameOf(request);
          const { requester } = request;
          return (
            <VStack key={request.id} space="sm">
              <HStack space="md" className="items-center">
                <Avatar size="sm">
                  {requester.avatarUrl ? (
                    <AvatarImage source={{ uri: getAvatarUrl(requester.avatarUrl) }} />
                  ) : (
                    <AvatarFallbackText>
                      {getInitials({ fullName: requester.fullName, username: requester.username })}
                    </AvatarFallbackText>
                  )}
                </Avatar>
                <VStack className="flex-1">
                  <Text className="font-medium text-typography-900">{name}</Text>
                  {requester.username && requester.fullName && (
                    <Text className="text-sm text-typography-500">@{requester.username}</Text>
                  )}
                </VStack>
              </HStack>
              <HStack space="sm" className="justify-end">
                <Button
                  variant="outline"
                  action="secondary"
                  size="sm"
                  onPress={() => handleDecline(request)}
                  isDisabled={isBusy}
                  accessibilityLabel={t("groups.joinRequests.decline")}
                  accessibilityHint={t("groups.joinRequests.declineHint", { name })}
                >
                  <ButtonText>{t("groups.joinRequests.decline")}</ButtonText>
                </Button>
                <Button
                  variant="solid"
                  action="primary"
                  size="sm"
                  onPress={() => handleAccept(request)}
                  isDisabled={isBusy}
                  accessibilityLabel={t("groups.joinRequests.accept")}
                  accessibilityHint={t("groups.joinRequests.acceptHint", { name })}
                >
                  {acceptJoinRequest.loading && <ButtonSpinner color={Colors.white} />}
                  <ButtonText>{t("groups.joinRequests.accept")}</ButtonText>
                </Button>
              </HStack>
            </VStack>
          );
        })}
      </VStack>
    </Card>
  );
}

JoinRequestsSection.displayName = "JoinRequestsSection";
