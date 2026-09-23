import { useFestivals } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AnalyticsPlatform, Festival } from "@prostcounter/shared/schemas";
import { ANALYTICS_RANGE_PRESETS, festivalRangeKey } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { ScrollView } from "@/components/ui/scroll-view";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityHint: string;
}

function Chip({ label, selected, onPress, accessibilityHint }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      className={cn(
        "rounded-full border px-3 py-1.5",
        selected ? "border-primary-500 bg-primary-500" : "border-outline-200 bg-background-0",
      )}
    >
      <Text className={cn("text-sm", selected ? "text-white" : "text-typography-700")}>
        {label}
      </Text>
    </Pressable>
  );
}

const PLATFORM_OPTIONS: readonly (AnalyticsPlatform | undefined)[] = [undefined, "ios", "android"];

interface AnalyticsFiltersProps {
  rangeKey: string;
  onRangeKeyChange: (rangeKey: string) => void;
  platform: AnalyticsPlatform | undefined;
  onPlatformChange: (platform: AnalyticsPlatform | undefined) => void;
}

export function AnalyticsFilters({
  rangeKey,
  onRangeKeyChange,
  platform,
  onPlatformChange,
}: AnalyticsFiltersProps) {
  const { t } = useTranslation();
  const { data: festivals } = useFestivals() as { data: Festival[] | null | undefined };
  const rangeHint = t("admin.analytics.filters.range");
  const platformHint = t("admin.analytics.filters.platform");

  return (
    <VStack space="sm">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <HStack space="sm">
          {ANALYTICS_RANGE_PRESETS.map((preset) => (
            <Chip
              key={preset}
              label={t(`admin.analytics.ranges.${preset}`)}
              selected={rangeKey === preset}
              onPress={() => onRangeKeyChange(preset)}
              accessibilityHint={rangeHint}
            />
          ))}
          {(festivals ?? []).map((festival) => (
            <Chip
              key={festival.id}
              label={festival.name}
              selected={rangeKey === festivalRangeKey(festival.id)}
              onPress={() => onRangeKeyChange(festivalRangeKey(festival.id))}
              accessibilityHint={rangeHint}
            />
          ))}
        </HStack>
      </ScrollView>
      <HStack space="sm">
        {PLATFORM_OPTIONS.map((option) => (
          <Chip
            key={option ?? "all"}
            label={t(`admin.analytics.platforms.${option ?? "all"}`)}
            selected={platform === option}
            onPress={() => onPlatformChange(option)}
            accessibilityHint={platformHint}
          />
        ))}
      </HStack>
    </VStack>
  );
}
