import { getAppUrl } from "@prostcounter/shared";
import { useRenewInviteToken } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { QrCode, RefreshCw } from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import QRCode from "react-native-qrcode-svg";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

interface QRCodeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  inviteToken?: string | null;
}

/**
 * QR Code Sheet component
 * Displays a QR code that others can scan to join the group
 */
export function QRCodeSheet({
  isOpen,
  onClose,
  groupId,
  groupName,
  inviteToken: initialToken,
}: QRCodeSheetProps) {
  const { t } = useTranslation();
  const [currentToken, setCurrentToken] = useState<string | null>(
    initialToken || null,
  );
  const [isGenerating, setIsGenerating] = useState(false);

  const renewToken = useRenewInviteToken();

  // Update token when prop changes
  useEffect(() => {
    if (initialToken) {
      setCurrentToken(initialToken);
    }
  }, [initialToken]);

  // Generate new token when sheet opens if no token exists
  useEffect(() => {
    if (isOpen && !currentToken && !isGenerating) {
      handleRegenerateToken();
    }
  }, [isOpen, currentToken]);

  const handleRegenerateToken = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await renewToken.mutateAsync({ groupId });
      setCurrentToken(result.inviteToken);
    } catch (error) {
      console.error("Failed to generate token:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [groupId, renewToken]);

  const appUrl = getAppUrl();
  const joinUrl = currentToken
    ? `${appUrl}/api/join-group?token=${currentToken}`
    : null;

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="bg-background-0 pb-8">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="lg" className="w-full items-center px-4 py-4">
          {/* Header */}
          <VStack space="xs" className="items-center">
            <HStack space="sm" className="items-center">
              <QrCode size={24} color={IconColors.primary} />
              <Heading size="lg" className="text-typography-900">
                {t("groups.qrCode.title")}
              </Heading>
            </HStack>
            <Text className="text-center text-sm text-typography-500">
              {t("groups.qrCode.description", {
                name: groupName,
              })}
            </Text>
          </VStack>

          {/* QR Code */}
          <VStack className="items-center rounded-2xl bg-white p-6">
            {isGenerating || !joinUrl ? (
              <VStack className="h-52 w-52 items-center justify-center">
                <Spinner size="large" />
                <Text className="mt-2 text-sm text-typography-500">
                  {t("groups.qrCode.generating")}
                </Text>
              </VStack>
            ) : (
              <QRCode
                value={joinUrl}
                size={208}
                color="#000000"
                backgroundColor="#FFFFFF"
              />
            )}
          </VStack>

          {/* Helper text */}
          <Text className="text-center text-sm text-typography-500">
            {t("groups.qrCode.helper")}
          </Text>

          {/* Regenerate button */}
          <Button
            variant="outline"
            action="secondary"
            size="md"
            onPress={handleRegenerateToken}
            isDisabled={isGenerating}
            className="mt-2"
          >
            {isGenerating ? (
              <ButtonSpinner color={Colors.gray[500]} />
            ) : (
              <RefreshCw size={16} color={IconColors.default} />
            )}
            <ButtonText className="ml-2">
              {t("groups.qrCode.regenerate")}
            </ButtonText>
          </Button>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

QRCodeSheet.displayName = "QRCodeSheet";
