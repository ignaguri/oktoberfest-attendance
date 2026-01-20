import { Beer, Plus } from "lucide-react-native";

import { Fab, FabIcon } from "@/components/ui/fab";

interface QuickAttendanceFabProps {
  onPress: () => void;
  disabled?: boolean;
}

/**
 * Floating Action Button for quick attendance logging
 *
 * Positioned above the tab bar (68px from bottom = 52px tab bar + 16px margin)
 * Shows Plus + Beer icons, disabled when festival is inactive
 */
export function QuickAttendanceFab({
  onPress,
  disabled = false,
}: QuickAttendanceFabProps) {
  return (
    <Fab
      size="lg"
      placement="bottom right"
      onPress={onPress}
      isDisabled={disabled}
      className="bottom-[68px] px-5 py-5"
      accessibilityLabel="Quick add drink"
      accessibilityHint="Opens quick attendance sheet to log a drink"
    >
      <FabIcon as={Plus} size="lg" className="mr-1" />
      <FabIcon as={Beer} size="lg" />
    </Fab>
  );
}

QuickAttendanceFab.displayName = "QuickAttendanceFab";
