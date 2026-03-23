import { useTranslation } from "@prostcounter/shared/i18n";
import { Download } from "lucide-react-native";
import { View } from "react-native";

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors } from "@/lib/constants/colors";

interface UpdateAvailablePromptProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => Promise<void>;
  isLoading: boolean;
}

/**
 * Prompt shown when an OTA update has been downloaded and is ready to apply.
 *
 * Follows the same AlertDialog pattern as NotificationPermissionPrompt.
 */
export function UpdateAvailablePrompt({
  isOpen,
  onClose,
  onUpdate,
  isLoading,
}: UpdateAvailablePromptProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} size="md">
      <AlertDialogBackdrop />
      <AlertDialogContent className="bg-background-0">
        <AlertDialogHeader className="flex-col items-center pb-4">
          <View
            className="mb-4 rounded-full p-4"
            style={{ backgroundColor: `${Colors.primary[500]}20` }}
          >
            <Download size={40} color={Colors.primary[500]} />
          </View>
          <Heading size="lg" className="text-center">
            {t("update.available.title")}
          </Heading>
        </AlertDialogHeader>

        <AlertDialogBody>
          <VStack space="md">
            <Text className="text-center text-typography-600">
              {t("update.available.description")}
            </Text>
          </VStack>
        </AlertDialogBody>

        <AlertDialogFooter className="flex-col gap-2 pt-4">
          <Button
            className="w-full"
            onPress={onUpdate}
            disabled={isLoading}
            accessibilityLabel={t("update.available.restartNow")}
          >
            {isLoading ? (
              <ButtonSpinner color="white" />
            ) : (
              <ButtonText>{t("update.available.restartNow")}</ButtonText>
            )}
          </Button>
          <Button
            variant="link"
            className="w-full"
            onPress={onClose}
            disabled={isLoading}
            accessibilityLabel={t("update.available.later")}
          >
            <ButtonText className="text-typography-500">
              {t("update.available.later")}
            </ButtonText>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
