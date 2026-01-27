import { useTranslation } from "@prostcounter/shared/i18n";
import { Bell, Clock, Trophy, Users } from "lucide-react-native";
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

interface NotificationPermissionPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onEnable: () => Promise<void>;
  onSkip: () => void;
}

/**
 * Custom pre-permission prompt explaining notification benefits.
 *
 * Shows before the native permission dialog to explain why notifications
 * are useful and increase opt-in rates.
 */
export function NotificationPermissionPrompt({
  isOpen,
  onClose,
  onEnable,
  onSkip,
}: NotificationPermissionPromptProps) {
  const { t } = useTranslation();

  const benefits = [
    {
      icon: Users,
      text: t("profile.notifications.benefits.groups", {
        defaultValue: "Know when friends check in at the festival",
      }),
    },
    {
      icon: Trophy,
      text: t("profile.notifications.benefits.achievements", {
        defaultValue: "Celebrate when you unlock achievements",
      }),
    },
    {
      icon: Clock,
      text: t("profile.notifications.benefits.reminders", {
        defaultValue: "Get reminders for your reservations",
      }),
    },
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
            <Bell size={40} color={Colors.primary[500]} />
          </View>
          <Heading size="lg" className="text-center">
            {t("profile.notifications.promptTitle", {
              defaultValue: "Stay in the Loop",
            })}
          </Heading>
        </AlertDialogHeader>

        <AlertDialogBody>
          <VStack space="md">
            <Text className="text-center text-typography-600">
              {t("profile.notifications.promptDescription", {
                defaultValue:
                  "Enable notifications to get the most out of ProstCounter",
              })}
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

            <Text className="text-center text-xs text-typography-500">
              {t("profile.notifications.promptNote", {
                defaultValue:
                  "You can change your notification preferences at any time in Settings",
              })}
            </Text>
          </VStack>
        </AlertDialogBody>

        <AlertDialogFooter className="flex-col gap-2 pt-4">
          <Button
            className="w-full"
            onPress={async () => {
              await onEnable();
              onClose();
            }}
            accessibilityLabel={t("profile.notifications.enable", {
              defaultValue: "Enable Notifications",
            })}
          >
            <ButtonText>
              {t("profile.notifications.enable", {
                defaultValue: "Enable Notifications",
              })}
            </ButtonText>
          </Button>
          <Button
            variant="link"
            className="w-full"
            onPress={() => {
              onSkip();
              onClose();
            }}
            accessibilityLabel={t("profile.notifications.skip", {
              defaultValue: "Maybe Later",
            })}
          >
            <ButtonText className="text-typography-500">
              {t("profile.notifications.skip", {
                defaultValue: "Maybe Later",
              })}
            </ButtonText>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
