import { useFestival } from "@prostcounter/shared/contexts";
import { useFestivalCountdown } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { BellRing } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Linking, Platform } from "react-native";

import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { isFestivalAlertDismissed, setFestivalAlertDismissed } from "@/lib/auth/secure-storage";
import { IconColors } from "@/lib/constants/colors";
import { useNotificationContextSafe } from "@/lib/notifications/NotificationContext";
import { shouldShowFestivalAlertCard } from "@/lib/notifications/push-registration-rules";
import { usePushRegistration } from "@/lib/notifications/usePushRegistration";

export function FestivalAlertCard() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const countdown = useFestivalCountdown(currentFestival);
  const { permissionStatus, isPermissionLoading, requestPermission } = useNotificationContextSafe();
  const { register, isRegistering } = usePushRegistration();
  const [dismissed, setDismissed] = useState(true); // hidden until storage is read

  const festivalId = currentFestival?.id;

  useEffect(() => {
    if (!festivalId) {
      return;
    }
    let isCancelled = false;
    isFestivalAlertDismissed(festivalId).then((isDismissed) => {
      if (!isCancelled) {
        setDismissed(isDismissed);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [festivalId]);

  const isVisible =
    !!currentFestival &&
    shouldShowFestivalAlertCard({
      phase: countdown?.phase ?? null,
      permissionStatus,
      isPermissionLoading,
      dismissed,
      isWeb: Platform.OS === "web",
    });

  if (!isVisible || !currentFestival) {
    return null;
  }

  const isDenied = permissionStatus === "denied";

  const handleEnable = async () => {
    if (isDenied) {
      if (Platform.OS === "ios") {
        Linking.openURL("app-settings:");
      } else {
        Linking.openSettings();
      }
      return;
    }
    const granted = await requestPermission();
    if (granted) {
      await register();
    }
  };

  const handleDismiss = async () => {
    setDismissed(true);
    await setFestivalAlertDismissed(currentFestival.id);
  };

  return (
    <Card size="md" variant="elevated" className="p-4">
      <VStack space="sm">
        <HStack space="sm" className="items-center">
          <BellRing size={22} color={IconColors.primary} />
          <Text className="text-base font-bold text-typography-900">
            {t("notifications.festivalAlert.title")}
          </Text>
        </HStack>
        <Text className="text-sm text-typography-600">
          {t("notifications.festivalAlert.description", { festivalName: currentFestival.name })}
        </Text>
        <HStack space="sm" className="justify-end">
          <Button
            variant="link"
            onPress={handleDismiss}
            accessibilityLabel={t("notifications.festivalAlert.dismiss")}
            accessibilityHint={t("notifications.festivalAlert.dismissHint")}
          >
            <ButtonText>{t("notifications.festivalAlert.dismiss")}</ButtonText>
          </Button>
          <Button
            onPress={handleEnable}
            isDisabled={isRegistering}
            accessibilityLabel={
              isDenied
                ? t("notifications.festivalAlert.openSettings")
                : t("notifications.festivalAlert.enable")
            }
            accessibilityHint={
              isDenied
                ? t("notifications.festivalAlert.openSettingsHint")
                : t("notifications.festivalAlert.enableHint")
            }
          >
            <ButtonText>
              {isDenied
                ? t("notifications.festivalAlert.openSettings")
                : t("notifications.festivalAlert.enable")}
            </ButtonText>
          </Button>
        </HStack>
      </VStack>
    </Card>
  );
}
