import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTranslation } from "@prostcounter/shared/i18n";

import type { AchievementStats } from "@prostcounter/shared/schemas";

interface AchievementStatsSummaryProps {
  stats: AchievementStats;
}

/**
 * Summary row showing achievement progress and total points
 */
export function AchievementStatsSummary({
  stats,
}: AchievementStatsSummaryProps) {
  const { t } = useTranslation();
  const { total_achievements, unlocked_achievements, total_points } = stats;
  const percentage =
    total_achievements > 0
      ? Math.round((unlocked_achievements / total_achievements) * 100)
      : 0;

  return (
    <Card
      variant="outline"
      size="sm"
      className="border-primary-200 bg-primary-50"
    >
      <HStack className="items-center justify-around p-4">
        {/* Progress */}
        <VStack className="items-center">
          <Text className="text-primary-700 text-2xl font-bold">
            {unlocked_achievements}/{total_achievements}
          </Text>
          <Text className="text-primary-600 text-xs">
            {t("achievements.unlocked")}
          </Text>
        </VStack>

        {/* Divider */}
        <VStack className="bg-primary-200 h-10 w-px" />

        {/* Percentage */}
        <VStack className="items-center">
          <Text className="text-primary-700 text-2xl font-bold">
            {percentage}%
          </Text>
          <Text className="text-primary-600 text-xs">
            {t("achievements.complete")}
          </Text>
        </VStack>

        {/* Divider */}
        <VStack className="bg-primary-200 h-10 w-px" />

        {/* Points */}
        <VStack className="items-center">
          <Text className="text-primary-700 text-2xl font-bold">
            {total_points}
          </Text>
          <Text className="text-primary-600 text-xs">
            {t("achievements.totalPoints")}
          </Text>
        </VStack>
      </HStack>
    </Card>
  );
}

AchievementStatsSummary.displayName = "AchievementStatsSummary";
