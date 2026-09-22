import {
  useAcceptGroupInvitation,
  useDeclineGroupInvitation,
  useIncomingGroupInvitations,
} from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { GroupInvitation } from "@prostcounter/shared/schemas";
import { getInitials } from "@prostcounter/ui";
import { MailPlus } from "lucide-react-native";
import { useCallback } from "react";

import { Avatar, AvatarFallbackText, AvatarImage } from "@/components/ui/avatar";
import type { useAlertDialog } from "@/components/ui/alert-dialog";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { logger } from "@/lib/logger";
import { getAvatarUrl } from "@/lib/utils";

type ShowDialog = ReturnType<typeof useAlertDialog>["showDialog"];

interface PendingInvitationsSectionProps {
  /** The groups screen's dialog, so decline confirmation and errors share it */
  showDialog: ShowDialog;
}

/**
 * Invitations waiting for the current user, at the top of the groups tab.
 *
 * Renders nothing when there are none, so the groups screen can mount it
 * unconditionally.
 */
export function PendingInvitationsSection({ showDialog }: PendingInvitationsSectionProps) {
  const { t } = useTranslation();
  const { data } = useIncomingGroupInvitations();
  const accept = useAcceptGroupInvitation();
  const decline = useDeclineGroupInvitation();

  const invitations = (data as GroupInvitation[] | undefined) ?? [];

  const handleAccept = useCallback(
    async (invitation: GroupInvitation) => {
      try {
        await accept.mutateAsync(invitation.id);
      } catch (error) {
        logger.error("Failed to accept group invitation:", error);
        showDialog(t("common.status.error"), t("groups.invitations.acceptFailed"), "destructive");
      }
    },
    [accept, showDialog, t],
  );

  const handleDecline = useCallback(
    (invitation: GroupInvitation) => {
      showDialog(
        t("groups.invitations.declineTitle"),
        t("groups.invitations.declineMessage", { groupName: invitation.groupName }),
        "destructive",
        async () => {
          try {
            await decline.mutateAsync(invitation.id);
          } catch (error) {
            logger.error("Failed to decline group invitation:", error);
            showDialog(
              t("common.status.error"),
              t("groups.invitations.declineFailed"),
              "destructive",
            );
          }
        },
      );
    },
    [decline, showDialog, t],
  );

  if (invitations.length === 0) {
    return null;
  }

  const isBusy = accept.loading || decline.loading;

  return (
    <VStack className="p-4 pb-0">
      <Card variant="outline" size="md" className="bg-background-0">
        <VStack space="md">
          <HStack space="sm" className="items-center">
            <MailPlus size={20} color={IconColors.primary} />
            <Text className="text-base font-semibold text-typography-900">
              {t("groups.invitations.sectionTitle")}
            </Text>
          </HStack>

          {invitations.map((invitation) => {
            const { inviter } = invitation;
            const inviterName = inviter.fullName || inviter.username || t("common.unknownUser");

            return (
              <VStack key={invitation.id} space="sm">
                <HStack space="md" className="items-center">
                  <Avatar size="sm">
                    {inviter.avatarUrl ? (
                      <AvatarImage source={{ uri: getAvatarUrl(inviter.avatarUrl) }} />
                    ) : (
                      <AvatarFallbackText>
                        {getInitials({ fullName: inviter.fullName, username: inviter.username })}
                      </AvatarFallbackText>
                    )}
                  </Avatar>
                  <VStack className="flex-1">
                    <Text className="font-medium text-typography-900">
                      {t("groups.invitations.invitedYou", {
                        inviterName,
                        groupName: invitation.groupName,
                      })}
                    </Text>
                  </VStack>
                </HStack>

                <HStack space="sm" className="justify-end">
                  <Button
                    variant="outline"
                    action="secondary"
                    size="sm"
                    onPress={() => handleDecline(invitation)}
                    isDisabled={isBusy}
                    accessibilityLabel={t("groups.invitations.decline")}
                    accessibilityHint={t("groups.invitations.declineHint", {
                      groupName: invitation.groupName,
                    })}
                  >
                    <ButtonText>{t("groups.invitations.decline")}</ButtonText>
                  </Button>
                  <Button
                    variant="solid"
                    action="primary"
                    size="sm"
                    onPress={() => handleAccept(invitation)}
                    isDisabled={isBusy}
                    accessibilityLabel={t("groups.invitations.accept")}
                    accessibilityHint={t("groups.invitations.acceptHint", {
                      groupName: invitation.groupName,
                    })}
                  >
                    {accept.loading && <ButtonSpinner color={IconColors.white} />}
                    <ButtonText>{t("groups.invitations.accept")}</ButtonText>
                  </Button>
                </HStack>
              </VStack>
            );
          })}
        </VStack>
      </Card>
    </VStack>
  );
}

PendingInvitationsSection.displayName = "PendingInvitationsSection";
