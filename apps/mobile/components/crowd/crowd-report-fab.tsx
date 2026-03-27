import { useTranslation } from "@prostcounter/shared/i18n";
import { Users } from "lucide-react-native";

import { Fab, FabIcon } from "@/components/ui/fab";

interface CrowdReportFabProps {
  onPress: () => void;
}

/**
 * Secondary FAB for crowd reporting.
 * No positioning -- parent container handles absolute placement.
 */
export function CrowdReportFab({ onPress }: CrowdReportFabProps) {
  const { t } = useTranslation();

  return (
    <Fab
      size="md"
      onPress={onPress}
      className="relative bg-amber-600 px-3 py-3 hover:bg-amber-700 active:bg-amber-800"
      accessibilityLabel={t("crowdReport.fab.accessibilityLabel")}
      accessibilityHint={t("crowdReport.fab.accessibilityHint")}
    >
      <FabIcon as={Users} size="md" />
    </Fab>
  );
}

CrowdReportFab.displayName = "CrowdReportFab";
