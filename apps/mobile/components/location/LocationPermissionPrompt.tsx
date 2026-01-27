import { useTranslation } from "@prostcounter/shared/i18n";
import { MapPin, Navigation, Shield, Users } from "lucide-react-native";
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

interface LocationPermissionPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onEnable: () => Promise<void>;
  onSkip: () => void;
}

/**
 * Custom pre-permission prompt explaining location benefits.
 *
 * Shows before the native permission dialog to explain why location
 * sharing is useful and increase opt-in rates.
 */
export function LocationPermissionPrompt({
  isOpen,
  onClose,
  onEnable,
  onSkip,
}: LocationPermissionPromptProps) {
  const { t } = useTranslation();

  const benefits = [
    {
      icon: Users,
      text: t("location.benefits.findFriends", {
        defaultValue: "Find your friends on the festival map",
      }),
    },
    {
      icon: Navigation,
      text: t("location.benefits.nearbyTents", {
        defaultValue: "Get suggestions when you're near a tent",
      }),
    },
    {
      icon: Shield,
      text: t("location.benefits.privacy", {
        defaultValue: "Only visible to your group members",
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
            <MapPin size={40} color={Colors.primary[500]} />
          </View>
          <Heading size="lg" className="text-center">
            {t("location.promptTitle", {
              defaultValue: "Share Your Location",
            })}
          </Heading>
        </AlertDialogHeader>

        <AlertDialogBody>
          <VStack space="md">
            <Text className="text-typography-600 text-center">
              {t("location.promptDescription", {
                defaultValue:
                  "Enable location sharing to find friends and discover nearby tents",
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
                  <Text className="text-typography-700 flex-1 text-sm">
                    {benefit.text}
                  </Text>
                </HStack>
              ))}
            </VStack>

            <Text className="text-typography-500 text-center text-xs">
              {t("location.promptNote", {
                defaultValue: "You can turn off location sharing at any time",
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
            accessibilityLabel={t("location.enable", {
              defaultValue: "Enable Location",
            })}
          >
            <ButtonText>
              {t("location.enable", {
                defaultValue: "Enable Location",
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
            accessibilityLabel={t("location.skip", {
              defaultValue: "Maybe Later",
            })}
          >
            <ButtonText className="text-typography-500">
              {t("location.skip", {
                defaultValue: "Maybe Later",
              })}
            </ButtonText>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
