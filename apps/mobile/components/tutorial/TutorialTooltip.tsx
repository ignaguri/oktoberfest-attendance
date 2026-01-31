/**
 * TutorialTooltip - Info card displayed during tutorial steps
 *
 * Shows step title, description, progress indicator, and navigation buttons.
 * Position adjusts based on target location (top/bottom/center).
 */

import { useTranslation } from "@prostcounter/shared/i18n";
import { useEffect, useRef } from "react";
import { Animated, Dimensions, StyleSheet, View } from "react-native";

import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors } from "@/lib/constants/colors";
import {
  type TargetMeasurement,
  type TooltipPosition,
  TUTORIAL_SIZING,
  TUTORIAL_TIMING,
  type TutorialStep,
} from "@/lib/tutorial";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface TutorialTooltipProps {
  /** Current tutorial step */
  step: TutorialStep;
  /** Current step index (0-based) */
  currentIndex: number;
  /** Total number of steps */
  totalSteps: number;
  /** Measurement of the target (null for centered steps) */
  targetMeasurement: TargetMeasurement | null;
  /** Handler for next button */
  onNext: () => void;
  /** Handler for previous button */
  onPrevious: () => void;
  /** Handler for skip button */
  onSkip: () => void;
  /** Whether this is the last step */
  isLastStep: boolean;
  /** Whether this is the first step */
  isFirstStep: boolean;
  /** Whether the tooltip should be visible */
  visible: boolean;
}

export function TutorialTooltip({
  step,
  currentIndex,
  totalSteps,
  targetMeasurement,
  onNext,
  onPrevious,
  onSkip,
  isLastStep,
  isFirstStep,
  visible,
}: TutorialTooltipProps) {
  const { t } = useTranslation();
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: TUTORIAL_TIMING.TOOLTIP_ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      opacityAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible, opacityAnim, scaleAnim]);

  if (!visible) return null;

  // Get translated content
  const title = t(`${step.translationKey}.title`);
  const description = t(`${step.translationKey}.description`);

  // Calculate tooltip position
  const tooltipStyle = calculateTooltipPosition(
    step.tooltipPosition,
    targetMeasurement,
  );

  return (
    <Animated.View
      style={[
        styles.container,
        tooltipStyle,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Card size="lg" variant="elevated" className="bg-white shadow-lg">
        <VStack space="md" className="p-4">
          {/* Title */}
          <Heading size="md" className="text-typography-900">
            {title}
          </Heading>

          {/* Description */}
          <Text size="sm" className="text-typography-600">
            {description}
          </Text>

          {/* Progress indicator */}
          <HStack className="items-center justify-center">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index === currentIndex && styles.progressDotActive,
                ]}
              />
            ))}
          </HStack>

          {/* Navigation buttons */}
          <HStack space="sm" className="items-center justify-between">
            {/* Skip button (left side) */}
            {!isLastStep ? (
              <Button
                variant="link"
                size="sm"
                onPress={onSkip}
                accessibilityLabel={t("mobileTutorial.buttons.skip")}
              >
                <ButtonText className="text-typography-500">
                  {t("mobileTutorial.buttons.skip")}
                </ButtonText>
              </Button>
            ) : (
              <View style={styles.buttonPlaceholder} />
            )}

            {/* Previous/Next buttons (right side) */}
            <HStack space="sm">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  size="sm"
                  onPress={onPrevious}
                  accessibilityLabel={t("mobileTutorial.buttons.previous")}
                >
                  <ButtonText>
                    {t("mobileTutorial.buttons.previous")}
                  </ButtonText>
                </Button>
              )}

              <Button
                variant="solid"
                size="sm"
                onPress={onNext}
                className="bg-primary-500"
                accessibilityLabel={
                  isLastStep
                    ? t("mobileTutorial.buttons.getStarted")
                    : t("mobileTutorial.buttons.next")
                }
              >
                <ButtonText className="text-white">
                  {isLastStep
                    ? t("mobileTutorial.buttons.getStarted")
                    : t("mobileTutorial.buttons.next")}
                </ButtonText>
              </Button>
            </HStack>
          </HStack>
        </VStack>
      </Card>
    </Animated.View>
  );
}

/**
 * Calculate tooltip position based on target and preferred position
 */
function calculateTooltipPosition(
  position: TooltipPosition,
  targetMeasurement: TargetMeasurement | null,
): { top?: number; bottom?: number; left: number; right: number } {
  const margin = TUTORIAL_SIZING.TOOLTIP_SCREEN_MARGIN;
  const gap = TUTORIAL_SIZING.TOOLTIP_SPOTLIGHT_GAP;
  const padding = TUTORIAL_SIZING.SPOTLIGHT_PADDING;

  // Centered position (for welcome/complete steps)
  if (position === "center" || !targetMeasurement) {
    return {
      top: SCREEN_HEIGHT * 0.35,
      left: margin,
      right: margin,
    };
  }

  const targetBottom =
    targetMeasurement.pageY + targetMeasurement.height + padding;
  const targetTop = targetMeasurement.pageY - padding;

  if (position === "bottom") {
    // Position below the target
    return {
      top: targetBottom + gap,
      left: margin,
      right: margin,
    };
  }

  if (position === "top") {
    // Position above the target
    // We use bottom positioning to place it above
    const bottomOffset = SCREEN_HEIGHT - targetTop + gap;
    return {
      bottom: bottomOffset,
      left: margin,
      right: margin,
    };
  }

  // Default to center
  return {
    top: SCREEN_HEIGHT * 0.35,
    left: margin,
    right: margin,
  };
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 1001,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gray[300],
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: Colors.primary[500],
    width: 24,
  },
  buttonPlaceholder: {
    width: 60, // Approximate width of skip button
  },
});

TutorialTooltip.displayName = "TutorialTooltip";
