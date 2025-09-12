"use client";

import { useTutorial } from "@/contexts/TutorialContext";
import { useEffect, useState } from "react";

import { TutorialSpotlight } from "./TutorialSpotlight";
import { TutorialTooltip } from "./TutorialTooltip";

export function TutorialOverlay() {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    previousStep,
    skipTutorial,
    endTutorial,
    canGoNext,
    canGoPrevious,
  } = useTutorial();

  const [showStep, setShowStep] = useState(false);

  useEffect(() => {
    if (!isActive || !currentStep) {
      setShowStep(false);
      return;
    }

    const scrollToElement = async () => {
      // For center position (welcome step), don't scroll
      if (currentStep.target === "body") {
        setShowStep(true);
        return;
      }

      const element = document.querySelector(currentStep.target);
      if (!element) {
        setShowStep(true);
        return;
      }

      // Calculate optimal scroll position based on step position
      const elementRect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const elementHeight = elementRect.height;

      let targetScrollY = window.scrollY;

      if (currentStep.position === "top") {
        // Position element in upper third of viewport with padding
        targetScrollY = window.scrollY + elementRect.top - 150;
      } else if (currentStep.position === "bottom") {
        // Position element in lower third of viewport with space for tooltip
        targetScrollY = window.scrollY + elementRect.top - viewportHeight * 0.7;
      } else if (
        currentStep.position === "left" ||
        currentStep.position === "right"
      ) {
        // Center vertically for side positions
        targetScrollY = window.scrollY + elementRect.top - viewportHeight * 0.4;
      }

      // Smooth scroll to the calculated position
      window.scrollTo({
        top: Math.max(0, targetScrollY),
        behavior: "smooth",
      });

      // Wait for scroll to complete before showing step
      // Use a more reliable method to detect scroll completion
      let scrollEndTimer: NodeJS.Timeout;
      const checkScrollEnd = () => {
        clearTimeout(scrollEndTimer);
        scrollEndTimer = setTimeout(() => {
          setShowStep(true);
        }, 100);
      };

      // Listen for scroll end
      window.addEventListener("scroll", checkScrollEnd, {
        passive: true,
        once: true,
      });

      // Fallback timeout
      setTimeout(() => {
        setShowStep(true);
      }, 1000);
    };

    // Add delay if specified in step
    const delay = currentStep.delay || 0;
    const timer = setTimeout(scrollToElement, delay);

    return () => clearTimeout(timer);
  }, [isActive, currentStep]);

  if (!isActive || !currentStep || !showStep) {
    return null;
  }

  const handleNext = () => {
    nextStep();
  };

  const handlePrevious = () => {
    previousStep();
  };

  const handleSkip = async () => {
    await skipTutorial();
  };

  const handleClose = async () => {
    await endTutorial();
  };

  return (
    <>
      <TutorialSpotlight
        target={currentStep.target}
        isActive={isActive && showStep}
      />
      <TutorialTooltip
        step={currentStep}
        isActive={isActive && showStep}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onSkip={handleSkip}
        onClose={handleClose}
        canGoNext={canGoNext}
        canGoPrevious={canGoPrevious}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
      />
    </>
  );
}
