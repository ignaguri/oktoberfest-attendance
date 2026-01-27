import { useTranslation } from "@prostcounter/shared/i18n";
import { Beer, ChevronRight, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutUp,
} from "react-native-reanimated";

import { Box } from "@/components/ui/box";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors, IconColors } from "@/lib/constants/colors";
import { useLocationContext } from "@/lib/location";

interface TentProximityBannerProps {
  /**
   * Called when user taps the banner to check in
   */
  onCheckIn?: (tentId: string, tentName: string) => void;
  /**
   * Distance threshold to show banner (meters)
   */
  threshold?: number;
  /**
   * Whether the user has already checked in at this tent today
   */
  hasCheckedIn?: boolean;
}

/**
 * Animated banner that appears when user is near a tent.
 * Suggests checking in to the nearest tent.
 */
export function TentProximityBanner({
  onCheckIn,
  threshold = 50,
  hasCheckedIn = false,
}: TentProximityBannerProps) {
  const { t } = useTranslation();
  const { closestTent, isSharing } = useLocationContext();
  const [dismissed, setDismissed] = useState(false);
  const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    // Clear any existing timeout
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }
    // Reset dismissed state after 5 minutes
    dismissTimeoutRef.current = setTimeout(
      () => setDismissed(false),
      5 * 60 * 1000,
    );
  }, []);

  const handlePress = useCallback(() => {
    if (closestTent && onCheckIn) {
      onCheckIn(closestTent.tentId, closestTent.tentName);
    }
  }, [closestTent, onCheckIn]);

  // Don't show if:
  // - Not sharing location
  // - No tent nearby
  // - Tent is too far away
  // - Banner was dismissed
  // - Already checked in
  if (
    !isSharing ||
    !closestTent ||
    closestTent.distanceMeters > threshold ||
    dismissed ||
    hasCheckedIn
  ) {
    return null;
  }

  const distanceText =
    closestTent.distanceMeters < 10
      ? t("location.proximity.veryClose", { defaultValue: "You're here!" })
      : t("location.proximity.distance", {
          meters: Math.round(closestTent.distanceMeters),
          defaultValue: "{{meters}}m away",
        });

  return (
    <Animated.View
      entering={SlideInUp.duration(300)}
      exiting={SlideOutUp.duration(300)}
      className="mx-4 mb-2"
    >
      <Pressable
        onPress={handlePress}
        className="active:opacity-90"
        accessibilityRole="button"
        accessibilityLabel={t("location.proximity.checkIn", {
          tent: closestTent.tentName,
          defaultValue: `Check in at ${closestTent.tentName}`,
        })}
        accessibilityHint={t("location.proximity.hint", {
          defaultValue: "Tap to add this tent to your attendance",
        })}
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          className="overflow-hidden rounded-xl"
          style={{
            backgroundColor: Colors.primary[500],
            shadowColor: Colors.primary[700],
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <HStack className="items-center justify-between p-3">
            <HStack space="md" className="flex-1 items-center">
              <Box className="rounded-full bg-white/20 p-2">
                <Beer size={24} color="white" />
              </Box>
              <VStack className="flex-1">
                <Text
                  className="text-base font-semibold text-white"
                  numberOfLines={1}
                >
                  {closestTent.tentName}
                </Text>
                <Text className="text-sm text-white/80">{distanceText}</Text>
              </VStack>
            </HStack>

            <HStack space="sm" className="items-center">
              <Box className="rounded-full bg-white/20 px-3 py-1">
                <Text className="text-sm font-medium text-white">
                  {t("location.proximity.checkInButton", {
                    defaultValue: "Check in",
                  })}
                </Text>
              </Box>
              <ChevronRight size={20} color="white" />
            </HStack>
          </HStack>
        </Animated.View>
      </Pressable>

      {/* Dismiss button */}
      <Pressable
        onPress={handleDismiss}
        className="absolute -right-2 -top-2 rounded-full bg-background-50 p-1"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
          elevation: 3,
        }}
        accessibilityLabel={t("common.dismiss", { defaultValue: "Dismiss" })}
      >
        <X size={16} color={IconColors.default} />
      </Pressable>
    </Animated.View>
  );
}
