"use client";

import { TUTORIAL_CONSTANTS } from "@/components/Tutorial/constants";
import { useCompleteTutorial } from "@/hooks/useProfile";
import { tutorialSteps, type TutorialStep } from "@/lib/tutorialSteps";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  startTransition,
} from "react";

import type { ReactNode } from "react";

interface TutorialContextType {
  isActive: boolean;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  isCompleted: boolean;
  totalSteps: number;
  startTutorial: () => void;
  endTutorial: () => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  goToStep: (stepId: string) => void;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

const TutorialContext = createContext<TutorialContextType | undefined>(
  undefined,
);

interface TutorialProviderProps {
  children: ReactNode;
  initialTutorialCompleted?: boolean;
  isLoadingStatus?: boolean;
}

export function TutorialProvider({
  children,
  initialTutorialCompleted = false,
  isLoadingStatus = false,
}: TutorialProviderProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(initialTutorialCompleted);
  const [visibleSteps, setVisibleSteps] = useState<TutorialStep[]>([]);
  const { mutateAsync: completeTutorial } = useCompleteTutorial();

  // Sync internal state with prop changes (when cache is invalidated)
  useEffect(() => {
    setIsCompleted(initialTutorialCompleted);
  }, [initialTutorialCompleted]);

  // Filter tutorial steps to only include those with visible elements
  const getVisibleSteps = () => {
    return tutorialSteps
      .map((step) => {
        // Handle special cases for dynamic targeting
        if (step.id === "groups") {
          // Check if user has groups - if not, target the "Join or Create a Group" button
          const groupsContainer = document.querySelector(
            '[data-tutorial="groups"]',
          );
          const joinButton =
            groupsContainer?.querySelector('a[href="/groups"]');

          if (joinButton) {
            // User has no groups, target the button instead
            console.debug(
              `Tutorial: Dynamic targeting for groups step - targeting button instead of container`,
            );
            return {
              ...step,
              target: 'a[href="/groups"]',
              position: "top" as const,
            };
          }
        }

        return step;
      })
      .filter((step) => {
        if (step.target === "body") return true; // Always include welcome step

        const element = document.querySelector(step.target);
        if (!element) {
          console.debug(
            `Tutorial: Skipping step "${step.id}" - element not found: ${step.target}`,
          );
          return false;
        }

        // Check if element is visible (not hidden by CSS)
        const rect = element.getBoundingClientRect();
        const isVisible =
          rect.width > 0 &&
          rect.height > 0 &&
          getComputedStyle(element).display !== "none" &&
          getComputedStyle(element).visibility !== "hidden";

        if (!isVisible) {
          console.debug(
            `Tutorial: Skipping step "${step.id}" - element not visible: ${step.target}`,
          );
          return false;
        }

        return true;
      });
  };

  // Update visible steps when tutorial becomes active
  useEffect(() => {
    if (isActive) {
      const steps = getVisibleSteps();
      startTransition(() => {
        setVisibleSteps(steps);
        setCurrentStepIndex(0); // Reset to first visible step
      });
    }
  }, [isActive]);

  const currentStep =
    isActive && currentStepIndex < visibleSteps.length
      ? visibleSteps[currentStepIndex]
      : null;

  const canGoNext = currentStepIndex < visibleSteps.length - 1;
  const canGoPrevious = currentStepIndex > 0;

  const startTutorial = () => {
    if (isCompleted) return;
    setIsActive(true);
    setCurrentStepIndex(0);
  };

  const endTutorial = async () => {
    setIsActive(false);
    setCurrentStepIndex(0);
    setIsCompleted(true);

    // Save completion to database via mutation hook (invalidates cache)
    try {
      await completeTutorial(undefined);
    } catch (error) {
      console.error("Failed to save tutorial completion:", error);
    }
  };

  const nextStep = () => {
    if (canGoNext) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      endTutorial();
    }
  };

  const previousStep = () => {
    if (canGoPrevious) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const skipTutorial = async () => {
    await endTutorial();
  };

  const goToStep = (stepId: string) => {
    const stepIndex = visibleSteps.findIndex((step) => step.id === stepId);
    if (stepIndex >= 0) {
      setCurrentStepIndex(stepIndex);
    }
  };

  // Auto-start tutorial for new users (only after status is loaded)
  useEffect(() => {
    if (!isLoadingStatus && !isCompleted && !isActive) {
      // Small delay to ensure page is loaded
      const timer = setTimeout(() => {
        startTutorial();
      }, TUTORIAL_CONSTANTS.AUTO_START_DELAY);
      return () => clearTimeout(timer);
    }
  }, [isLoadingStatus, isCompleted, isActive]);

  const value: TutorialContextType = {
    isActive,
    currentStep,
    currentStepIndex,
    isCompleted,
    totalSteps: visibleSteps.length,
    startTutorial,
    endTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    goToStep,
    canGoNext,
    canGoPrevious,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
}
