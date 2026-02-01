/**
 * Tutorial Context for mobile app
 *
 * Manages tutorial state, target ref registration, and navigation between steps.
 * Uses the shared hooks (useTutorialStatus, useCompleteTutorial) for persistence.
 */

import {
  useCompleteTutorial,
  useTutorialStatus,
} from "@prostcounter/shared/hooks";
import { type Href, useRouter } from "expo-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { View } from "react-native";

import { useAuth } from "@/lib/auth/AuthContext";
import { logger } from "@/lib/logger";

import { TUTORIAL_TIMING } from "./constants";
import {
  TOTAL_STEPS,
  TUTORIAL_STEPS,
  type TutorialStep,
} from "./tutorialSteps";

/** Measurement data for a target component */
export interface TargetMeasurement {
  /** Horizontal position in screen coordinates */
  x: number;
  /** Vertical position in screen coordinates */
  y: number;
  /** Width of the target in pixels */
  width: number;
  /** Height of the target in pixels */
  height: number;
  /** Alias for x (compatibility with measurement APIs) */
  pageX: number;
  /** Alias for y (compatibility with measurement APIs) */
  pageY: number;
}

interface TutorialContextValue {
  /** Whether the tutorial is currently showing */
  isActive: boolean;
  /** Current step index (0-based) */
  currentStepIndex: number;
  /** Current step data */
  currentStep: TutorialStep | null;
  /** Total number of steps */
  totalSteps: number;
  /** Whether tutorial has been completed */
  isCompleted: boolean;
  /** Whether tutorial status is still loading */
  isLoading: boolean;
  /** Register a target ref for a step */
  registerTarget: (stepId: string, ref: View | null) => void;
  /** Unregister a target ref */
  unregisterTarget: (stepId: string) => void;
  /** Get measurement for a target */
  getTargetMeasurement: (stepId: string) => Promise<TargetMeasurement | null>;
  /** Move to the next step */
  nextStep: () => void;
  /** Move to the previous step */
  previousStep: () => void;
  /** Skip and complete the tutorial */
  skipTutorial: () => void;
  /** End the tutorial (mark as complete) */
  endTutorial: () => void;
  /** Start the tutorial manually */
  startTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

interface TutorialProviderProps {
  children: ReactNode;
}

function TutorialProviderInner({ children }: TutorialProviderProps) {
  const { isAuthenticated } = useAuth();
  const { data: tutorialStatus, loading: isLoading } = useTutorialStatus();
  const completeTutorial = useCompleteTutorial();
  const router = useRouter();

  // Tutorial state
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  // Target refs stored in a Map
  const targetRefs = useRef<Map<string, View>>(new Map());

  const isCompleted = tutorialStatus?.tutorial_completed ?? false;

  // Auto-start tutorial for new users (only once per session)
  useEffect(() => {
    // Safety check: only auto-start if we have valid tutorial status data
    // Explicitly check tutorialStatus is defined (not just truthy)
    if (
      isAuthenticated &&
      !isLoading &&
      tutorialStatus !== undefined &&
      tutorialStatus !== null &&
      !isCompleted &&
      !hasAutoStarted &&
      !isActive
    ) {
      const timer = setTimeout(() => {
        setIsActive(true);
        setCurrentStepIndex(0);
        setHasAutoStarted(true);
      }, TUTORIAL_TIMING.AUTO_START_DELAY);

      return () => clearTimeout(timer);
    }
  }, [
    isAuthenticated,
    isLoading,
    tutorialStatus,
    isCompleted,
    hasAutoStarted,
    isActive,
  ]);

  const currentStep = useMemo(
    () => TUTORIAL_STEPS[currentStepIndex] ?? null,
    [currentStepIndex],
  );

  // Navigate to the appropriate tab when the step changes
  useEffect(() => {
    const tabRoute = currentStep?.tabRoute;
    if (!isActive || !tabRoute) return;

    // Small delay to allow the UI to settle before navigation
    const timer = setTimeout(() => {
      try {
        // Use navigate with the tab route
        router.navigate(tabRoute as Href);
      } catch (error) {
        logger.warn("Failed to navigate during tutorial", { error });
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isActive, currentStep?.tabRoute, router]);

  const registerTarget = useCallback((stepId: string, ref: View | null) => {
    if (ref) {
      targetRefs.current.set(stepId, ref);
    } else {
      targetRefs.current.delete(stepId);
    }
  }, []);

  const unregisterTarget = useCallback((stepId: string) => {
    targetRefs.current.delete(stepId);
  }, []);

  const getTargetMeasurement = useCallback(
    (stepId: string): Promise<TargetMeasurement | null> => {
      return new Promise((resolve) => {
        try {
          const ref = targetRefs.current.get(stepId);
          if (!ref) {
            resolve(null);
            return;
          }

          ref.measureInWindow((x, y, width, height) => {
            if (width === 0 && height === 0) {
              // Component not yet laid out
              resolve(null);
              return;
            }
            resolve({
              x,
              y,
              width,
              height,
              pageX: x,
              pageY: y,
            });
          });
        } catch (error) {
          // Fail gracefully if measurement fails
          logger.warn("Failed to measure tutorial target", { error });
          resolve(null);
        }
      });
    },
    [],
  );

  const nextStep = useCallback(() => {
    if (currentStepIndex < TOTAL_STEPS - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      // Last step, complete the tutorial
      completeTutorial.mutate();
      setIsActive(false);
      setCurrentStepIndex(0);
    }
  }, [currentStepIndex, completeTutorial]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const skipTutorial = useCallback(() => {
    completeTutorial.mutate();
    setIsActive(false);
    setCurrentStepIndex(0);
  }, [completeTutorial]);

  // endTutorial is an alias for skipTutorial (both complete the tutorial)
  const endTutorial = skipTutorial;

  const startTutorial = useCallback(() => {
    setIsActive(true);
    setCurrentStepIndex(0);
  }, []);

  const value = useMemo(
    () => ({
      isActive,
      currentStepIndex,
      currentStep,
      totalSteps: TOTAL_STEPS,
      isCompleted,
      isLoading,
      registerTarget,
      unregisterTarget,
      getTargetMeasurement,
      nextStep,
      previousStep,
      skipTutorial,
      endTutorial,
      startTutorial,
    }),
    [
      isActive,
      currentStepIndex,
      currentStep,
      isCompleted,
      isLoading,
      registerTarget,
      unregisterTarget,
      getTargetMeasurement,
      nextStep,
      previousStep,
      skipTutorial,
      endTutorial,
      startTutorial,
    ],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

/**
 * Outer TutorialProvider that checks authentication before providing tutorial context
 * This prevents errors when tutorial hooks are called for unauthenticated users
 */
export function TutorialProvider({ children }: TutorialProviderProps) {
  const { isAuthenticated } = useAuth();

  // Only provide full tutorial functionality when authenticated
  // When not authenticated, provide a minimal context that does nothing
  if (!isAuthenticated) {
    const emptyValue: TutorialContextValue = {
      isActive: false,
      currentStepIndex: 0,
      currentStep: null,
      totalSteps: TOTAL_STEPS,
      isCompleted: false,
      isLoading: false,
      registerTarget: () => {},
      unregisterTarget: () => {},
      getTargetMeasurement: async () => null,
      nextStep: () => {},
      previousStep: () => {},
      skipTutorial: () => {},
      endTutorial: () => {},
      startTutorial: () => {},
    };

    return (
      <TutorialContext.Provider value={emptyValue}>
        {children}
      </TutorialContext.Provider>
    );
  }

  // When authenticated, use the full implementation
  return <TutorialProviderInner>{children}</TutorialProviderInner>;
}

export function useTutorial(): TutorialContextValue {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within a TutorialProvider");
  }
  return context;
}

/**
 * Safe version that returns a default value when outside provider
 * Useful for components that may render before provider is mounted
 */
export function useTutorialSafe(): TutorialContextValue | null {
  return useContext(TutorialContext);
}
