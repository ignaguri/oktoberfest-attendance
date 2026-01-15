import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";
import { useTranslation } from "@prostcounter/shared/i18n";
import React from "react";

interface DangerZoneProps {
  showDeleteConfirm: boolean;
  isDeleting: boolean;
  onDeletePress: () => void;
  onCancelDelete: () => void;
}

export function DangerZone({
  showDeleteConfirm,
  isDeleting,
  onDeletePress,
  onCancelDelete,
}: DangerZoneProps) {
  const { t } = useTranslation();

  return (
    <Card size="md" variant="outline" className="border-red-200 bg-red-50">
      <VStack space="md" className="items-center">
        <Text className="text-lg font-semibold text-red-700">
          {t("profile.deleteAccount.title")}
        </Text>
        {showDeleteConfirm ? (
          <>
            <Text className="text-center text-sm text-red-600">
              {t("profile.deleteAccount.warning")}
            </Text>
            <HStack space="md">
              <Button
                variant="outline"
                className="flex-1 border-red-300"
                onPress={onCancelDelete}
                accessibilityLabel={t("common.buttons.cancel")}
              >
                <ButtonText className="text-red-600">
                  {t("common.buttons.cancel")}
                </ButtonText>
              </Button>
              <Button
                className="flex-1 bg-red-500"
                onPress={onDeletePress}
                disabled={isDeleting}
                accessibilityLabel={t("profile.deleteAccount.confirm")}
              >
                {isDeleting ? (
                  <ButtonSpinner color={IconColors.white} />
                ) : (
                  <ButtonText>{t("profile.deleteAccount.confirm")}</ButtonText>
                )}
              </Button>
            </HStack>
          </>
        ) : (
          <>
            <Text className="text-center text-sm text-red-600">
              {t("profile.deleteAccount.description")}
            </Text>
            <Button
              action="negative"
              onPress={onDeletePress}
              accessibilityLabel={t("profile.deleteAccount.button")}
            >
              <ButtonText>{t("profile.deleteAccount.button")}</ButtonText>
            </Button>
          </>
        )}
      </VStack>
    </Card>
  );
}

DangerZone.displayName = "DangerZone";
