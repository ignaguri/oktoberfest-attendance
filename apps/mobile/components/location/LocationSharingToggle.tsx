import { useTranslation } from "@prostcounter/shared/i18n";
import { MapPin, Radio } from "lucide-react-native";
import { useCallback, useState } from "react";
import { View } from "react-native";

import { Button, ButtonSpinner, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { useLocationContext } from "@/lib/location";

import { LocationPermissionPrompt } from "./LocationPermissionPrompt";

interface LocationSharingToggleProps {
  festivalId: string;
  compact?: boolean;
}

const DURATION_OPTIONS = [
  { value: 30, labelKey: "location.duration.30m" as const },
  { value: 60, labelKey: "location.duration.1h" as const },
  { value: 120, labelKey: "location.duration.2h" as const },
  { value: 240, labelKey: "location.duration.4h" as const },
];

/**
 * Toggle component for location sharing with duration selector.
 */
export function LocationSharingToggle({
  festivalId,
  compact = false,
}: LocationSharingToggleProps) {
  const { t } = useTranslation();
  const {
    isSharing,
    isSessionLoading,
    hasPermission,
    hasPromptBeenShown,
    requestPermission,
    markPromptAsShown,
    startSharing,
    stopSharing,
    nearbyMembers,
  } = useLocationContext();

  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(120);
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = useCallback(async () => {
    if (isSharing) {
      setIsToggling(true);
      try {
        await stopSharing();
      } finally {
        setIsToggling(false);
      }
      return;
    }

    // Check if we need to show permission prompt
    if (!hasPermission && !hasPromptBeenShown) {
      setShowPermissionPrompt(true);
      return;
    }

    // If we have permission or prompt was already shown, try to start
    setIsToggling(true);
    try {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) return;
      }
      await startSharing(festivalId, selectedDuration);
    } finally {
      setIsToggling(false);
    }
  }, [
    isSharing,
    hasPermission,
    hasPromptBeenShown,
    stopSharing,
    startSharing,
    requestPermission,
    festivalId,
    selectedDuration,
  ]);

  const handleEnableFromPrompt = useCallback(async () => {
    await markPromptAsShown();
    const granted = await requestPermission();
    if (granted) {
      await startSharing(festivalId, selectedDuration);
    }
  }, [
    markPromptAsShown,
    requestPermission,
    startSharing,
    festivalId,
    selectedDuration,
  ]);

  const handleSkipPrompt = useCallback(async () => {
    await markPromptAsShown();
  }, [markPromptAsShown]);

  if (compact) {
    return (
      <>
        <Pressable
          onPress={handleToggle}
          disabled={isToggling || isSessionLoading}
          className="active:opacity-70"
          accessibilityLabel={
            isSharing ? t("location.stopSharing") : t("location.startSharing")
          }
        >
          <HStack space="sm" className="items-center">
            <View
              className="rounded-full p-2"
              style={{
                backgroundColor: isSharing
                  ? Colors.success[500]
                  : Colors.neutral[200],
              }}
            >
              {isSharing ? (
                <Radio size={16} color="white" />
              ) : (
                <MapPin size={16} color={IconColors.default} />
              )}
            </View>
            <VStack>
              <Text className="text-typography-900 text-sm font-medium">
                {isSharing
                  ? t("location.sharing.sharing")
                  : t("location.sharing.notSharing")}
              </Text>
              {isSharing && nearbyMembers.length > 0 && (
                <Text className="text-typography-500 text-xs">
                  {t("location.nearbyCount", { count: nearbyMembers.length })}
                </Text>
              )}
            </VStack>
          </HStack>
        </Pressable>

        <LocationPermissionPrompt
          isOpen={showPermissionPrompt}
          onClose={() => setShowPermissionPrompt(false)}
          onEnable={handleEnableFromPrompt}
          onSkip={handleSkipPrompt}
        />
      </>
    );
  }

  const selectedDurationOption = DURATION_OPTIONS.find(
    (o) => o.value === selectedDuration,
  );
  const selectedDurationLabel = selectedDurationOption
    ? t(selectedDurationOption.labelKey)
    : "";

  return (
    <>
      <Card size="md" variant="elevated" className="p-4">
        <VStack space="md">
          <HStack className="items-center justify-between">
            <HStack space="sm" className="items-center">
              <View
                className="rounded-full p-2"
                style={{
                  backgroundColor: isSharing
                    ? `${Colors.success[500]}20`
                    : `${Colors.primary[500]}20`,
                }}
              >
                {isSharing ? (
                  <Radio size={20} color={Colors.success[500]} />
                ) : (
                  <MapPin size={20} color={Colors.primary[500]} />
                )}
              </View>
              <VStack>
                <Text className="text-typography-900 font-semibold">
                  {t("location.sharing.title")}
                </Text>
                <Text className="text-typography-500 text-xs">
                  {isSharing
                    ? t("location.sharingActive")
                    : t("location.sharingInactive")}
                </Text>
              </VStack>
            </HStack>
          </HStack>

          {!isSharing && (
            <HStack space="sm" className="justify-center">
              {DURATION_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setSelectedDuration(option.value)}
                  className={`rounded-full px-4 py-2 ${
                    selectedDuration === option.value
                      ? "bg-primary-500"
                      : "bg-background-100"
                  }`}
                >
                  <Text
                    className={
                      selectedDuration === option.value
                        ? "font-medium text-white"
                        : "text-typography-600"
                    }
                  >
                    {t(option.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </HStack>
          )}

          <Button
            onPress={handleToggle}
            disabled={isToggling || isSessionLoading}
            action={isSharing ? "negative" : "primary"}
            accessibilityLabel={
              isSharing ? t("location.stopSharing") : t("location.startSharing")
            }
          >
            {(isToggling || isSessionLoading) && (
              <ButtonSpinner color={Colors.white} />
            )}
            <ButtonText>
              {isSharing
                ? t("location.stopSharing")
                : t("location.shareFor", { duration: selectedDurationLabel })}
            </ButtonText>
          </Button>
        </VStack>
      </Card>

      <LocationPermissionPrompt
        isOpen={showPermissionPrompt}
        onClose={() => setShowPermissionPrompt(false)}
        onEnable={handleEnableFromPrompt}
        onSkip={handleSkipPrompt}
      />
    </>
  );
}
