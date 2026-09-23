import { useCancelGroupInvitation, useSentGroupInvitations } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { SentGroupInvitation } from "@prostcounter/shared/schemas";
import { getInitials } from "@prostcounter/ui";
import { Send } from "lucide-react-native";
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

interface SentInvitationsSectionProps {
  groupId: string;
  /** The settings screen's dialog, so errors share it */
  showDialog: ShowDialog;
}

/**
 * Invitations the creator sent that nobody has answered yet.
 *
 * Renders nothing when there are none.
 */
export function SentInvitationsSection({ groupId, showDialog }: SentInvitationsSectionProps) {
  const { t } = useTranslation();
  const { data } = useSentGroupInvitations(groupId);
  const cancel = useCancelGroupInvitation(groupId);

  const invitations = (data as SentGroupInvitation[] | undefined) ?? [];

  // Coded API errors set `error.code` to the error code itself, so a specific
  // message (e.g. the invitation is no longer available) can be shown instead
  // of the generic fallback. i18next returns the key when it is missing,
  // which is how we detect an unmapped code without a defaultValue.
  const translateApiError = useCallback(
    (error: unknown, fallbackKey: string): string => {
      const code = (error as { code?: string })?.code;
      if (code) {
        const key = `apiErrors.${code}`;
        const translated = t(key);
        if (translated !== key) {
          return translated;
        }
      }
      return t(fallbackKey);
    },
    [t],
  );

  const handleCancel = useCallback(
    async (invitation: SentGroupInvitation) => {
      try {
        await cancel.mutateAsync(invitation.id);
      } catch (error) {
        logger.error("Failed to withdraw group invitation:", error);
        showDialog(
          t("common.status.error"),
          translateApiError(error, "groups.invitations.cancelFailed"),
          "destructive",
        );
      }
    },
    [cancel, showDialog, t, translateApiError],
  );

  if (invitations.length === 0) {
    return null;
  }

  return (
    <Card variant="outline" size="md" className="bg-background-0">
      <VStack space="md">
        <HStack space="sm" className="items-center">
          <Send size={20} color={IconColors.primary} />
          <Text className="text-base font-semibold text-typography-900">
            {t("groups.invitations.sentTitle")}
          </Text>
        </HStack>

        {invitations.map((invitation) => {
          const { invitee } = invitation;
          const name = invitee.fullName || invitee.username || t("common.unknownUser");

          return (
            <HStack key={invitation.id} space="md" className="items-center">
              <Avatar size="sm">
                {invitee.avatarUrl ? (
                  <AvatarImage source={{ uri: getAvatarUrl(invitee.avatarUrl) }} />
                ) : (
                  <AvatarFallbackText>
                    {getInitials({ fullName: invitee.fullName, username: invitee.username })}
                  </AvatarFallbackText>
                )}
              </Avatar>

              <VStack className="min-w-0 flex-1">
                <Text className="font-medium text-typography-900" numberOfLines={1}>
                  {name}
                </Text>
                <Text className="text-sm text-typography-500">
                  {t("groups.invitations.invited")}
                </Text>
              </VStack>

              <Button
                variant="outline"
                action="secondary"
                size="sm"
                onPress={() => handleCancel(invitation)}
                isDisabled={cancel.loading}
                accessibilityLabel={t("groups.invitations.cancelInvite")}
                accessibilityHint={t("groups.invitations.cancelInviteHint", { name })}
              >
                {cancel.loading && <ButtonSpinner />}
                <ButtonText>{t("groups.invitations.cancelInvite")}</ButtonText>
              </Button>
            </HStack>
          );
        })}
      </VStack>
    </Card>
  );
}

SentInvitationsSection.displayName = "SentInvitationsSection";
