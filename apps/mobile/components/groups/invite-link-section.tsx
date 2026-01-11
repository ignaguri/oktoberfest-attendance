import { useRenewInviteToken } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { Link, Copy, RefreshCw, Check, Share2 } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Share, Platform } from "react-native";

import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

interface InviteLinkSectionProps {
  groupId: string;
  groupName: string;
  inviteToken?: string;
  onTokenUpdated?: () => void;
}

export function InviteLinkSection({
  groupId,
  groupName,
  inviteToken,
  onTokenUpdated,
}: InviteLinkSectionProps) {
  const { t } = useTranslation();
  const renewToken = useRenewInviteToken();
  const [copied, setCopied] = useState(false);

  const inviteUrl = inviteToken
    ? `https://prostcounter.com/join-group?token=${inviteToken}`
    : "";

  // Handle copy to clipboard (uses Share as fallback)
  const handleCopy = useCallback(async () => {
    if (!inviteUrl) return;

    try {
      // Use Share API which allows copying on iOS
      await Share.share({
        message: inviteUrl,
        url: Platform.OS === "ios" ? inviteUrl : undefined,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }, [inviteUrl]);

  // Handle share
  const handleShare = useCallback(async () => {
    if (!inviteUrl) return;

    const message = t("groups.share.message", {
      defaultValue: `Join my group "${groupName}" on ProstCounter!`,
      name: groupName,
    });

    try {
      await Share.share({
        message: `${message}\n\n${inviteUrl}`,
        url: inviteUrl,
      });
    } catch (error) {
      console.error("Failed to share:", error);
    }
  }, [inviteUrl, groupName, t]);

  // Handle regenerate token
  const handleRegenerate = useCallback(async () => {
    try {
      await renewToken.mutateAsync({ groupId });
      onTokenUpdated?.();
    } catch (error) {
      console.error("Failed to regenerate token:", error);
    }
  }, [groupId, renewToken, onTokenUpdated]);

  const isRegenerating = renewToken.loading;

  return (
    <Card variant="outline" size="md">
      <VStack space="md">
        <HStack space="sm" className="items-center">
          <Link size={18} color={IconColors.primary} />
          <Text className="font-medium text-typography-900">
            {t("groups.settings.inviteLink", { defaultValue: "Invite Link" })}
          </Text>
        </HStack>

        {inviteToken ? (
          <>
            {/* Invite URL Display */}
            <Input size="md" isReadOnly>
              <InputField
                value={inviteUrl}
                className="text-sm text-typography-600"
                numberOfLines={1}
              />
            </Input>

            {/* Action Buttons */}
            <HStack space="sm" className="flex-wrap">
              <Button
                variant="outline"
                action="secondary"
                size="sm"
                className="flex-1"
                onPress={handleCopy}
              >
                {copied ? (
                  <Check size={16} color={IconColors.success} />
                ) : (
                  <Copy size={16} color={IconColors.default} />
                )}
                <ButtonText className="ml-1">
                  {copied
                    ? t("groups.settings.copied", { defaultValue: "Copied!" })
                    : t("groups.settings.copy", { defaultValue: "Copy" })}
                </ButtonText>
              </Button>

              <Button
                variant="outline"
                action="secondary"
                size="sm"
                className="flex-1"
                onPress={handleShare}
              >
                <Share2 size={16} color={IconColors.default} />
                <ButtonText className="ml-1">
                  {t("groups.actions.share", { defaultValue: "Share" })}
                </ButtonText>
              </Button>

              <Button
                variant="outline"
                action="secondary"
                size="sm"
                className="flex-1"
                onPress={handleRegenerate}
                isDisabled={isRegenerating}
              >
                {isRegenerating ? (
                  <ButtonSpinner color={Colors.gray[500]} />
                ) : (
                  <RefreshCw size={16} color={IconColors.default} />
                )}
                <ButtonText className="ml-1">
                  {t("groups.settings.regenerate", { defaultValue: "Regenerate" })}
                </ButtonText>
              </Button>
            </HStack>

            {/* Warning */}
            <Text className="text-xs text-typography-400">
              {t("groups.settings.tokenWarning", {
                defaultValue:
                  "Regenerating the link will invalidate the current one. Share the new link with members.",
              })}
            </Text>
          </>
        ) : (
          <VStack space="sm" className="items-center py-4">
            <Text className="text-center text-typography-500">
              {t("groups.settings.noToken", {
                defaultValue: "No invite link generated yet.",
              })}
            </Text>
            <Button
              variant="solid"
              action="primary"
              size="sm"
              onPress={handleRegenerate}
              isDisabled={isRegenerating}
            >
              {isRegenerating && <ButtonSpinner color={Colors.white} />}
              <ButtonText>
                {t("groups.settings.generateLink", { defaultValue: "Generate Link" })}
              </ButtonText>
            </Button>
          </VStack>
        )}
      </VStack>
    </Card>
  );
}

InviteLinkSection.displayName = "InviteLinkSection";
