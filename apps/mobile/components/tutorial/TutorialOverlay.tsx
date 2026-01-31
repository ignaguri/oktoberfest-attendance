/**
 * TutorialOverlay - Main orchestrator component for the tutorial
 *
 * Renders the spotlight and tooltip, manages target measurements,
 * and coordinates the tutorial flow.
 */

import { useCallback, useEffect, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";

import { logger } from "@/lib/logger";
import { type TargetMeasurement, useTutorial } from "@/lib/tutorial";

import { TutorialSpotlight } from "./TutorialSpotlight";
import { TutorialTooltip } from "./TutorialTooltip";

export function TutorialOverlay() {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    getTargetMeasurement,
    nextStep,
    previousStep,
    skipTutorial,
  } = useTutorial();

  const [targetMeasurement, setTargetMeasurement] =
    useState<TargetMeasurement | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Measure the target when step changes
  useEffect(() => {
    if (!isActive || !currentStep) {
      setTargetMeasurement(null);
      setIsReady(false);
      return;
    }

    const measureTarget = async () => {
      setIsReady(false);

      try {
        if (currentStep.targetId) {
          // Small delay to allow layout to settle
          await new Promise((resolve) => setTimeout(resolve, 100));
          const measurement = await getTargetMeasurement(currentStep.targetId);
          setTargetMeasurement(measurement);
        } else {
          // Centered steps have no target
          setTargetMeasurement(null);
        }
      } catch (error) {
        logger.warn("Failed to measure tutorial target", { error });
        // Continue with null measurement (will show centered)
        setTargetMeasurement(null);
      }

      setIsReady(true);
    };

    measureTarget();
  }, [isActive, currentStep, getTargetMeasurement]);

  const handleNext = useCallback(() => {
    setIsReady(false);
    nextStep();
  }, [nextStep]);

  const handlePrevious = useCallback(() => {
    setIsReady(false);
    previousStep();
  }, [previousStep]);

  const handleSkip = useCallback(() => {
    setIsReady(false);
    skipTutorial();
  }, [skipTutorial]);

  if (!isActive || !currentStep) {
    return null;
  }

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <Modal
      visible={isActive}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleSkip}
    >
      <View style={styles.container} pointerEvents="box-none">
        {/* Dark overlay with spotlight cutout */}
        <TutorialSpotlight
          targetMeasurement={targetMeasurement}
          visible={isReady}
        />

        {/* Tooltip with step info */}
        <TutorialTooltip
          step={currentStep}
          currentIndex={currentStepIndex}
          totalSteps={totalSteps}
          targetMeasurement={targetMeasurement}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSkip={handleSkip}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          visible={isReady}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

TutorialOverlay.displayName = "TutorialOverlay";
