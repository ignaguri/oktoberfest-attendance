import { Beer, Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fab, FabIcon } from "@/components/ui/fab";

interface QuickAttendanceFabProps {
  onPress: () => void;
  disabled?: boolean;
}

/**
 * Floating Action Button for quick attendance logging
 *
 * Positioned above the tab bar, accounting for safe area (home indicator)
 * Shows Plus + Beer icons, disabled when festival is inactive
 */
export function QuickAttendanceFab({
  onPress,
  disabled = false,
}: QuickAttendanceFabProps) {
  const insets = useSafeAreaInsets();
  // Native floating tab bar (iOS 18+) is a compact pill
  // Position FAB above it with margin for clearance
  // Devices without home indicator (insets.bottom = 0) need extra margin
  const floatingTabBarHeight = 50;
  const margin = insets.bottom === 0 ? 40 : 24;
  const bottomOffset = floatingTabBarHeight + margin + insets.bottom;

  return (
    <Fab
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
