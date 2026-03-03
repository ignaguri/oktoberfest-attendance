import { useTranslation } from "@prostcounter/shared/i18n";
import { Users } from "lucide-react-native";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fab, FabIcon } from "@/components/ui/fab";

interface CrowdReportFabProps {
  onPress: () => void;
}

/**
 * Secondary FAB for crowd reporting, positioned above the main beer FAB.
 * Only rendered when the user has visited tents today (caller controls visibility).
 * Uses Users icon to indicate crowd reporting.
 */
export function CrowdReportFab({ onPress }: CrowdReportFabProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // Match the same positioning logic as QuickAttendanceFab
  // but add extra offset to sit above it.
  // iOS native tab bar is ~50px; Android Material 3 bottom nav is ~100px.
  const nativeTabBarHeight = Platform.OS === "android" ? 100 : 50;
  const margin = insets.bottom === 0 ? 40 : 24;
  const beerFabBottomOffset = nativeTabBarHeight + margin + insets.bottom;
  // Beer FAB is ~56px tall (lg size with px-5 py-5). Add gap of 12px.
  const crowdFabBottomOffset = beerFabBottomOffset + 56 + 12;

  return (
    <Fab
      size="md"
      placement="bottom right"
      onPress={onPress}
      style={{ bottom: crowdFabBottomOffset }}
      className="bg-amber-600 px-3 py-3 hover:bg-amber-700 active:bg-amber-800"
      accessibilityLabel={t("crowdReport.fab.accessibilityLabel")}
      accessibilityHint={t("crowdReport.fab.accessibilityHint")}
    >
      <FabIcon as={Users} size="md" />
    </Fab>
  );
}

CrowdReportFab.displayName = "CrowdReportFab";
