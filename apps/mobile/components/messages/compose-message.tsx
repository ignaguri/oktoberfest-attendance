import { usePostMessage } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { GroupMessageType } from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";
import { AlertTriangle, MessageSquare, Send } from "lucide-react-native";
import { useCallback, useState } from "react";
import { TextInput } from "react-native";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";

const MAX_CHARS = 1000;

interface ComposeMessageProps {
  isOpen: boolean;
  onClose: () => void;
  festivalId: string;
  onSuccess?: () => void;
}

/**
 * Bottom sheet for composing a new message
 *
 * Messages are posted to the festival (visible to all user's groups).
 *
 * Features:
 * - Text input with character counter
 * - Toggle between message and alert type
 * - Send button with loading state
 */
export function ComposeMessage({
  isOpen,
  onClose,
  festivalId,
  onSuccess,
}: ComposeMessageProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [messageType, setMessageType] = useState<GroupMessageType>("message");

  const postMessage = usePostMessage();

  const handleSend = useCallback(async () => {
    if (!content.trim() || !festivalId) return;

    try {
      await postMessage.mutateAsync({
        content: content.trim(),
        messageType,
        festivalId,
      });
      setContent("");
      setMessageType("message");
      onClose();
      onSuccess?.();
    } catch {
      // Error is handled by the mutation
    }
  }, [content, messageType, festivalId, postMessage, onClose, onSuccess]);

  const handleClose = useCallback(() => {
    setContent("");
    setMessageType("message");
    onClose();
  }, [onClose]);

  const charCount = content.length;
  const isOverLimit = charCount > MAX_CHARS;
  const canSend = content.trim().length > 0 && !isOverLimit;

  return (
    <Actionsheet isOpen={isOpen} onClose={handleClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="pb-8">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView className="w-full">
          <VStack space="md" className="px-2 pb-4 pt-2">
            <VStack space="xs">
              <Heading size="md" className="text-typography-900">
                {t("groups.messages.compose.title")}
              </Heading>
              <Text className="text-sm text-typography-500">
                {messageType === "alert"
                  ? t("groups.messages.compose.subtitleAlert")
                  : t("groups.messages.compose.subtitleMessage")}
              </Text>
            </VStack>

            {/* Message type toggle */}
            <HStack space="sm">
              <Pressable
                onPress={() => setMessageType("message")}
                className={cn(
                  "flex-1 flex-row items-center justify-center gap-2 rounded-lg border-2 px-3 py-2",
                  messageType === "message"
                    ? "border-primary-500 bg-primary-50"
                    : "border-outline-200 bg-white",
                )}
                accessibilityLabel={t("groups.messages.compose.typeMessage")}
              >
                <MessageSquare
                  size={18}
                  color={
                    messageType === "message"
                      ? Colors.primary[500]
                      : IconColors.muted
                  }
                />
                <Text
                  className={cn(
                    "text-sm font-medium",
                    messageType === "message"
                      ? "text-primary-600"
                      : "text-typography-500",
                  )}
                >
                  {t("groups.messages.compose.typeMessage")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMessageType("alert")}
                className={cn(
                  "flex-1 flex-row items-center justify-center gap-2 rounded-lg border-2 px-3 py-2",
                  messageType === "alert"
                    ? "border-primary-500 bg-amber-50"
                    : "border-outline-200 bg-white",
                )}
                accessibilityLabel={t("groups.messages.compose.typeAlert")}
              >
                <AlertTriangle
                  size={18}
                  color={
                    messageType === "alert"
                      ? Colors.primary[500]
                      : IconColors.muted
                  }
                />
                <Text
                  className={cn(
                    "text-sm font-medium",
                    messageType === "alert"
                      ? "text-primary-600"
                      : "text-typography-500",
                  )}
                >
                  {t("groups.messages.compose.typeAlert")}
                </Text>
              </Pressable>
            </HStack>

            {/* Text input */}
            <VStack space="xs">
              <TextInput
                value={content}
                onChangeText={setContent}
                placeholder={t("groups.messages.compose.placeholder")}
                multiline
                numberOfLines={4}
                maxLength={MAX_CHARS + 50} // Allow slightly over for UX
                className="min-h-[100px] rounded-lg border border-outline-200 bg-white p-3 text-sm text-typography-900"
                textAlignVertical="top"
                autoFocus
              />
              <HStack className="items-center justify-between">
                <Text
                  className={cn(
                    "text-xs",
                    isOverLimit ? "text-error-500" : "text-typography-400",
                  )}
                >
                  {t("groups.messages.compose.charCount", {
                    count: charCount,
                    max: MAX_CHARS,
                  })}
                </Text>
              </HStack>
            </VStack>

            {/* Send button */}
            <Button
              action="primary"
              onPress={handleSend}
              disabled={!canSend || postMessage.loading}
              className="w-full"
            >
              {postMessage.loading ? (
                <ButtonSpinner color={Colors.white} />
              ) : (
                <Send size={18} color={Colors.white} />
              )}
              <ButtonText className="ml-2">
                {postMessage.loading
                  ? t("groups.messages.compose.sending")
                  : t("groups.messages.compose.send")}
              </ButtonText>
            </Button>
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

ComposeMessage.displayName = "ComposeMessage";
