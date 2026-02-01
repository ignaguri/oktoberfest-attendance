import { Beer, Plus } from "lucide-react-native";
import { useEffect, useRef } from "react";
import type { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fab, FabIcon } from "@/components/ui/fab";
import { useTutorialSafe } from "@/lib/tutorial";

interface QuickAttendanceFabProps {
  onPress: () => void;
  disabled?: boolean;
  /** Tutorial step ID for self-registration (bypasses TutorialTarget wrapper issues with absolute positioning) */
  tutorialStepId?: string;
}

/**
 * Floating Action Button for quick attendance logging
 *
 * Positioned above the tab bar, accounting for safe area (home indicator)
 * Shows Plus + Beer icons, disabled when festival is inactive
 *
 * Note: This component self-registers with the tutorial context because
 * the TutorialTarget wrapper doesn't work with absolutely positioned elements
 * (the wrapper View has 0x0 dimensions).
 */
export function QuickAttendanceFab({
  onPress,
  disabled = false,
  tutorialStepId,
}: QuickAttendanceFabProps) {
  const insets = useSafeAreaInsets();
  const tutorial = useTutorialSafe();
  const fabRef = useRef<View>(null);

  // Self-register with tutorial context for highlighting
  useEffect(() => {
    if (!tutorial || !tutorialStepId) return;
    tutorial.registerTarget(tutorialStepId, fabRef.current);
    return () => tutorial.unregisterTarget(tutorialStepId);
  }, [tutorial, tutorialStepId]);

  // Native floating tab bar (iOS 18+) is a compact pill
  // Position FAB above it with margin for clearance
  // Devices without home indicator (insets.bottom = 0) need extra margin
  const floatingTabBarHeight = 50;
  const margin = insets.bottom === 0 ? 40 : 24;
  const bottomOffset = floatingTabBarHeight + margin + insets.bottom;

  return (
    <Fab
      ref={fabRef}
      size="lg"
      placement="bottom right"
      onPress={onPress}
      isDisabled={disabled}
      style={{ bottom: bottomOffset }}
      className="px-5 py-5"
      accessibilityLabel="Quick add drink"
      accessibilityHint="Opens quick attendance sheet to log a drink"
    >
      <FabIcon as={Plus} size="lg" className="mr-1" />
      <FabIcon as={Beer} size="lg" />
    </Fab>
  );
}

QuickAttendanceFab.displayName = "QuickAttendanceFab";
