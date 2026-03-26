import { useTranslation } from "@prostcounter/shared/i18n";
import type { LucideIcon } from "lucide-react-native";
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
import { Colors } from "@/lib/constants/colors";

const ICON_BG_STYLE = { backgroundColor: `${Colors.primary[500]}20` } as const;

interface UpdatePromptProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void | Promise<void>;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
  primaryButtonKey: string;
  dismissButtonKey: string;
  isLoading?: boolean;
}

/**
 * Generic update prompt dialog used for both OTA updates and App Store updates.
 */
export function UpdatePrompt({
  isOpen,
  onClose,
  onUpdate,
  icon: Icon,
  titleKey,
  descriptionKey,
  primaryButtonKey,
  dismissButtonKey,
  isLoading = false,
}: UpdatePromptProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog isOpen={isOpen} onClose={onClose} size="md">
      <AlertDialogBackdrop />
      <AlertDialogContent className="bg-background-0">
        <AlertDialogHeader className="flex-col items-center pb-4">
          <View className="mb-4 rounded-full p-4" style={ICON_BG_STYLE}>
            <Icon size={40} color={Colors.primary[500]} />
          </View>
          <Heading size="lg" className="text-center">
            {t(titleKey)}
          </Heading>
        </AlertDialogHeader>

        <AlertDialogBody>
          <Text className="text-center text-typography-600">
            {t(descriptionKey)}
          </Text>
        </AlertDialogBody>

        <AlertDialogFooter className="flex-col gap-2 pt-4">
          <Button
            className="w-full"
            onPress={onUpdate}
            disabled={isLoading}
            accessibilityLabel={t(primaryButtonKey)}
          >
            {isLoading ? (
              <ButtonSpinner color="white" />
            ) : (
              <ButtonText>{t(primaryButtonKey)}</ButtonText>
            )}
          </Button>
          <Button
            variant="link"
            className="w-full"
            onPress={onClose}
            disabled={isLoading}
            accessibilityLabel={t(dismissButtonKey)}
          >
            <ButtonText className="text-typography-500">
              {t(dismissButtonKey)}
            </ButtonText>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
