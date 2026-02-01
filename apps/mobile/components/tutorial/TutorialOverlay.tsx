/**
 * TutorialOverlay - Main orchestrator component for the tutorial
 *
 * Renders the spotlight and tooltip, manages target measurements,
 * and coordinates the tutorial flow.
 */

import { useCallback, useEffect, useState } from "react";
import { Modal } from "react-native";

import { Box } from "@/components/ui/box";
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
    // Skip measurement when tutorial is inactive (component won't render anyway)
    if (!isActive || !currentStep) {
      return;
    }

    let isCancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const measureTarget = async () => {
      setIsReady(false);

      try {
        if (currentStep.targetId) {
          // Small delay to allow layout to settle
          await new Promise<void>((resolve) => {
            timeoutId = setTimeout(resolve, 100);
          });
          if (isCancelled) return;

          const measurement = await getTargetMeasurement(currentStep.targetId);
          if (isCancelled) return;

          setTargetMeasurement(measurement);
        } else {
          // Centered steps have no target
          setTargetMeasurement(null);
        }
      } catch (error) {
        if (isCancelled) return;
        logger.warn("Failed to measure tutorial target", { error });
        // Continue with null measurement (will show centered)
        setTargetMeasurement(null);
      }

      if (!isCancelled) {
        setIsReady(true);
      }
    };

    measureTarget();

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      // Reset state on cleanup to prepare for next activation
      setTargetMeasurement(null);
      setIsReady(false);
    };
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
      <Box className="flex-1" pointerEvents="box-none">
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
      </Box>
    </Modal>
  );
}

TutorialOverlay.displayName = "TutorialOverlay";
