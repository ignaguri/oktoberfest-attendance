import { useFestival } from "@prostcounter/shared/contexts";
import { useTranslation } from "@prostcounter/shared/i18n";

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
import { useAuth } from "@/lib/auth/AuthContext";

/**
 * Offers the live festival when the one restored on launch is not live, so a
 * pick made for an earlier festival does not silently stick.
 */
export function FestivalSwitchPrompt() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { currentFestival, switchSuggestion, setCurrentFestival, dismissSwitchSuggestion } =
    useFestival();

  if (!isAuthenticated || !currentFestival || !switchSuggestion) {
    return null;
  }

  return (
    <AlertDialog isOpen onClose={dismissSwitchSuggestion} size="md">
      <AlertDialogBackdrop />
      <AlertDialogContent>
        <AlertDialogHeader>
          <Heading size="lg" className="text-typography-950">
            {t("festival.switchPrompt.title", { festival: switchSuggestion.name })}
          </Heading>
        </AlertDialogHeader>
        <AlertDialogBody className="mb-4 mt-3">
          <Text size="sm" className="text-typography-500">
            {t("festival.switchPrompt.description", {
              current: currentFestival.name,
              festival: switchSuggestion.name,
            })}
          </Text>
        </AlertDialogBody>
        <AlertDialogFooter>
          <VStack space="sm" className="w-full">
            <Button
              action="primary"
              onPress={() => setCurrentFestival(switchSuggestion)}
              accessibilityLabel={t("festival.switchPrompt.switch", {
                festival: switchSuggestion.name,
              })}
              accessibilityHint={t("festival.switchPrompt.title", {
                festival: switchSuggestion.name,
              })}
            >
              <ButtonText>
                {t("festival.switchPrompt.switch", { festival: switchSuggestion.name })}
              </ButtonText>
            </Button>
            <Button
              variant="outline"
              action="secondary"
              onPress={dismissSwitchSuggestion}
              accessibilityLabel={t("festival.switchPrompt.stay", {
                current: currentFestival.name,
              })}
              accessibilityHint={t("festival.switchPrompt.description", {
                current: currentFestival.name,
                festival: switchSuggestion.name,
              })}
            >
              <ButtonText>
                {t("festival.switchPrompt.stay", { current: currentFestival.name })}
              </ButtonText>
            </Button>
          </VStack>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

FestivalSwitchPrompt.displayName = "FestivalSwitchPrompt";
