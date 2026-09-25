import { useFestival } from "@prostcounter/shared/contexts";
import { useFestivalCountdown, useHighlights } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";

import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { getSummaryProgressStats } from "@/lib/attendance/summary-progress-stats";

/** Streak, tents and photos row of the Attendance summary, styled like the rows above it */
export function SummaryProgressStats() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const countdown = useFestivalCountdown(currentFestival);
  const { data: highlights } = useHighlights(currentFestival?.id);

  if (!highlights?.progress) {
    return null;
  }

  const stats = getSummaryProgressStats({
    progress: highlights.progress,
    phase: countdown?.phase,
  });

  if (!stats) {
    return null;
  }

  return (
    <View className="mt-4 flex-row justify-around border-t border-background-200 pt-4">
      <View className="items-center">
        <Text className="text-2xl font-bold text-primary-500">{stats.streak.value}</Text>
        <Text className="text-xs text-typography-500">
          {t(stats.streak.labelKey, { count: stats.streak.value })}
        </Text>
      </View>
      <View className="items-center">
        <Text className="text-2xl font-bold text-primary-500">{stats.tents}</Text>
        <Text className="text-xs text-typography-500">{t("attendance.summary.tents")}</Text>
      </View>
      <View className="items-center">
        <Text className="text-2xl font-bold text-primary-500">{stats.photos}</Text>
        <Text className="text-xs text-typography-500">{t("attendance.summary.photos")}</Text>
      </View>
    </View>
  );
}
