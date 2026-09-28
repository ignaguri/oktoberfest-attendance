import { useFestivals } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { AnalyticsPlatform, Festival } from "@prostcounter/shared/schemas";
import { ANALYTICS_RANGE_PRESETS, festivalRangeKey } from "@prostcounter/shared/utils";
import { ChevronDown } from "lucide-react-native";
import { useMemo, useState } from "react";

import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

import { Chip } from "./chip";
import { RangePickerSheet } from "./range-picker-sheet";

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
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
  const rangeHint = t("admin.analytics.filters.range");
  const platformHint = t("admin.analytics.filters.platform");

  const presets = useMemo(
    () =>
      ANALYTICS_RANGE_PRESETS.map((preset) => ({
        key: preset,
        label: t(`admin.analytics.ranges.${preset}`),
      })),
    [t],
  );
  const rangeLabel =
    presets.find((preset) => preset.key === rangeKey)?.label ??
    festivals?.find((festival) => festivalRangeKey(festival.id) === rangeKey)?.name ??
    rangeHint;

  return (
    <VStack space="sm">
      <Pressable
        onPress={() => setIsRangePickerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={rangeLabel}
        accessibilityHint={rangeHint}
        className="flex-row items-center justify-between rounded-lg border border-outline-200 bg-background-0 px-3 py-2.5"
      >
        <Text className="text-typography-900">{rangeLabel}</Text>
        <ChevronDown size={18} color={IconColors.muted} />
      </Pressable>
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
      <RangePickerSheet
        isOpen={isRangePickerOpen}
        onClose={() => setIsRangePickerOpen(false)}
        presets={presets}
        festivals={festivals ?? []}
        rangeKey={rangeKey}
        onRangeKeyChange={onRangeKeyChange}
      />
    </VStack>
  );
}
