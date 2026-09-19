import { useTranslation } from "@prostcounter/shared/i18n";
import { Bell } from "lucide-react-native";
import { View } from "react-native";

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { NotificationPermissionStatus } from "@/lib/auth/secure-storage";
import { Colors } from "@/lib/constants/colors";
import {
  CONTEXTUAL_ASK_COPY_KEY,
  type NotificationAskTrigger,
} from "@/lib/notifications/contextual-ask";

interface NotificationAskDialogProps {
  /** The action that prompted the ask; null keeps the dialog closed. */
  trigger: NotificationAskTrigger | null;
  permissionStatus: NotificationPermissionStatus;
  onPrimary: () => Promise<void>;
  onNotNow: () => Promise<void>;
}

/**
 * Asks for notifications right after an action whose follow-up the user would
 * want to hear about. When the OS permission is already denied, the primary
 * button opens device settings instead of the OS prompt.
 */
export function NotificationAskDialog({
  trigger,
  permissionStatus,
  onPrimary,
  onNotNow,
}: NotificationAskDialogProps) {
  const { t } = useTranslation();
  const copyKey = CONTEXTUAL_ASK_COPY_KEY[trigger ?? "friend_request"];
  const isDenied = permissionStatus === "denied";
  const primaryLabel = isDenied
    ? t("notifications.ask.openSettings")
    : t("notifications.ask.enable");
  const primaryHint = isDenied
    ? t("notifications.ask.openSettingsHint")
    : t("notifications.ask.enableHint");

  return (
    <AlertDialog
      isOpen={trigger !== null}
      onClose={() => {
        void onNotNow();
      }}
      size="md"
    >
      <AlertDialogBackdrop />
      <AlertDialogContent className="bg-background-0">
        <AlertDialogHeader className="flex-col items-center pb-4">
          <View className="mb-4 rounded-full bg-primary-50 p-4">
            <Bell size={40} color={Colors.primary[500]} />
          </View>
          <Heading size="lg" className="text-center">
            {t(`notifications.ask.${copyKey}.title`)}
          </Heading>
        </AlertDialogHeader>

        <AlertDialogBody>
          <VStack space="sm">
            <Text className="text-center text-typography-600">
              {t(`notifications.ask.${copyKey}.body`)}
            </Text>
            {isDenied ? (
              <Text className="text-center text-xs text-typography-500">
                {t("notifications.ask.deniedNote")}
              </Text>
            ) : null}
          </VStack>
        </AlertDialogBody>

        <AlertDialogFooter className="flex-col gap-2 pt-4">
          <Button
            className="w-full"
            onPress={() => {
              void onPrimary();
            }}
            accessibilityLabel={primaryLabel}
            accessibilityHint={primaryHint}
          >
            <ButtonText>{primaryLabel}</ButtonText>
          </Button>
          <Button
            variant="link"
            className="w-full"
            onPress={() => {
              void onNotNow();
            }}
            accessibilityLabel={t("notifications.ask.notNow")}
            accessibilityHint={t("notifications.ask.notNowHint")}
          >
            <ButtonText className="text-typography-500">{t("notifications.ask.notNow")}</ButtonText>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
