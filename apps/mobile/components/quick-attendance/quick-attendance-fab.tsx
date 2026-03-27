import { Beer, Plus } from "lucide-react-native";
import { useEffect, useRef } from "react";

import { Fab, FabIcon } from "@/components/ui/fab";
import { useTutorialSafe } from "@/lib/tutorial";

interface QuickAttendanceFabProps {
  onPress: () => void;
  disabled?: boolean;
  tutorialStepId?: string;
}

/**
 * Floating Action Button for quick attendance logging.
 * No positioning -- parent container handles absolute placement.
 */
export function QuickAttendanceFab({
  onPress,
  disabled = false,
  tutorialStepId,
}: QuickAttendanceFabProps) {
  const tutorial = useTutorialSafe();
  const fabRef = useRef<any>(null);

  useEffect(() => {
    if (!tutorial || !tutorialStepId) return;
    tutorial.registerTarget(tutorialStepId, fabRef.current);
    return () => tutorial.unregisterTarget(tutorialStepId);
  }, [tutorial, tutorialStepId]);

  return (
    <Fab
      ref={fabRef}
      size="lg"
      onPress={onPress}
      isDisabled={disabled}
      className="relative px-5 py-5"
      accessibilityLabel="Quick add drink"
      accessibilityHint="Opens quick attendance sheet to log a drink"
    >
      <FabIcon as={Plus} size="lg" className="mr-1" />
      <FabIcon as={Beer} size="lg" />
    </Fab>
  );
}

QuickAttendanceFab.displayName = "QuickAttendanceFab";
