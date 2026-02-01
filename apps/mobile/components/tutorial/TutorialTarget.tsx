/**
 * TutorialTarget - Wrapper component for registering tutorial target refs
 *
 * Wrap any component that should be highlighted during the tutorial.
 * Uses collapsable={false} for Android compatibility with measure().
 */

import { type ReactNode, useEffect, useRef } from "react";
import { View } from "react-native";

import { useTutorialSafe } from "@/lib/tutorial";

interface TutorialTargetProps {
  /** The step ID this target corresponds to (matches TutorialStep.targetId) */
  stepId: string;
  /** The child component to wrap */
  children: ReactNode;
}

export function TutorialTarget({ stepId, children }: TutorialTargetProps) {
  const tutorial = useTutorialSafe();
  const viewRef = useRef<View>(null);

  useEffect(() => {
    if (!tutorial) return;

    // Register the ref when mounted
    tutorial.registerTarget(stepId, viewRef.current);

    // Unregister when unmounted
    return () => {
      tutorial.unregisterTarget(stepId);
    };
  }, [tutorial, stepId]);

  return (
    <View
      ref={viewRef}
      // collapsable={false} ensures Android can measure this view
      collapsable={false}
    >
      {children}
    </View>
  );
}

TutorialTarget.displayName = "TutorialTarget";
