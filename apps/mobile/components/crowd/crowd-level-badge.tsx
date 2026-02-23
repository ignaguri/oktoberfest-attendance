import { useTranslation } from "@prostcounter/shared/i18n";
import type { CrowdLevel } from "@prostcounter/shared/schemas";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";

/**
 * Color mapping for crowd levels
 */
const CROWD_COLORS: Record<CrowdLevel, string> = {
  empty: "#22C55E", // green-500
  moderate: "#EAB308", // yellow-500
  crowded: "#F97316", // orange-500
  full: "#EF4444", // red-500
};

const CROWD_BG_CLASSES: Record<CrowdLevel, string> = {
  empty: "bg-green-100",
  moderate: "bg-yellow-100",
  crowded: "bg-orange-100",
  full: "bg-red-100",
};

const CROWD_TEXT_CLASSES: Record<CrowdLevel, string> = {
  empty: "text-green-700",
  moderate: "text-yellow-700",
  crowded: "text-orange-700",
  full: "text-red-700",
};

interface CrowdLevelBadgeProps {
  crowdLevel: CrowdLevel | null;
  avgWaitMinutes?: number | null;
  compact?: boolean;
}

/**
 * Colored badge showing crowd level and optional wait time.
 * Used next to tent names in lists.
 */
export function CrowdLevelBadge({
  crowdLevel,
  avgWaitMinutes,
  compact = false,
}: CrowdLevelBadgeProps) {
  const { t } = useTranslation();

  if (!crowdLevel) {
    if (compact) return null;
    return (
      <Text className="text-xs text-typography-400">
        {t("crowdReport.noReports", { defaultValue: "No reports" })}
      </Text>
    );
  }

  const dotColor = CROWD_COLORS[crowdLevel];
  const bgClass = CROWD_BG_CLASSES[crowdLevel];
  const textClass = CROWD_TEXT_CLASSES[crowdLevel];

  return (
    <HStack space="xs" className="items-center">
      <View className={`px-2 py-0.5 rounded-full ${bgClass}`}>
        <HStack space="xs" className="items-center">
          <View
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
          <Text className={`text-xs font-medium ${textClass}`}>
            {t(`crowdReport.levels.${crowdLevel}`, {
              defaultValue: crowdLevel,
            })}
          </Text>
        </HStack>
      </View>
      {avgWaitMinutes != null && avgWaitMinutes > 0 && !compact && (
        <Text className="text-xs text-typography-500">
          {t("crowdReport.waitTime", {
            minutes: avgWaitMinutes,
            defaultValue: `~${avgWaitMinutes} min wait`,
          })}
        </Text>
      )}
    </HStack>
  );
}

CrowdLevelBadge.displayName = "CrowdLevelBadge";

export { CROWD_COLORS };
