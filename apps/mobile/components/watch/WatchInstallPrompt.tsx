import { useTranslation } from "@prostcounter/shared/i18n";
import { Beer, MapPin, Users, Watch } from "lucide-react-native";
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
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors } from "@/lib/constants/colors";

interface WatchInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => void | Promise<void>;
  onSkip: () => void;
}

/**
 * One-time prompt shown when the user has a paired Apple Watch but hasn't
 * installed the ProstCounter companion app. Mirrors the structure of
 * NotificationPermissionPrompt so the UI feels consistent with the other
 * system-level prompts (notifications, OTA updates, store updates).
 */
export function WatchInstallPrompt({
  isOpen,
  onClose,
  onInstall,
  onSkip,
}: WatchInstallPromptProps) {
  const { t } = useTranslation();

  const benefits = [
    { icon: Beer, text: t("watch.install.benefits.fastLog") },
    { icon: MapPin, text: t("watch.install.benefits.autoTent") },
    { icon: Users, text: t("watch.install.benefits.groupActivity") },
  ];

  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} size="md">
      <AlertDialogBackdrop />
      <AlertDialogContent className="bg-background-0">
        <AlertDialogHeader className="flex-col items-center pb-4">
          <View
            className="mb-4 rounded-full p-4"
            style={{ backgroundColor: `${Colors.primary[500]}20` }}
          >
            <Watch size={40} color={Colors.primary[500]} />
          </View>
          <Heading size="lg" className="text-center">
            {t("watch.install.promptTitle")}
          </Heading>
        </AlertDialogHeader>

        <AlertDialogBody>
          <VStack space="md">
            <Text className="text-center text-typography-600">
              {t("watch.install.promptDescription")}
            </Text>

            <VStack space="sm" className="py-4">
              {benefits.map((benefit, index) => (
                <HStack key={index} space="md" className="items-center">
                  <View
                    className="rounded-full p-2"
                    style={{ backgroundColor: `${Colors.primary[500]}10` }}
                  >
                    <benefit.icon size={20} color={Colors.primary[500]} />
                  </View>
                  <Text className="flex-1 text-sm text-typography-700">
                    {benefit.text}
                  </Text>
                </HStack>
              ))}
            </VStack>
          </VStack>
        </AlertDialogBody>

        <AlertDialogFooter className="flex-col gap-2 pt-4">
          <Button
            className="w-full"
            onPress={async () => {
              await onInstall();
              onClose();
            }}
            accessibilityLabel={t("watch.install.install")}
          >
            <ButtonText>{t("watch.install.install")}</ButtonText>
          </Button>
          <Button
            variant="link"
            className="w-full"
            onPress={() => {
              onSkip();
              onClose();
            }}
            accessibilityLabel={t("watch.install.skip")}
          >
            <ButtonText className="text-typography-500">
              {t("watch.install.skip")}
            </ButtonText>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
