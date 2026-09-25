import { useFestival } from "@prostcounter/shared/contexts";
import { useFestivalCountdown, useHighlights } from "@prostcounter/shared/hooks";
import { useTranslation } from "@prostcounter/shared/i18n";
import { getProgressLines } from "@prostcounter/shared/utils";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useState } from "react";
import { Pressable } from "react-native";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { IconColors } from "@/lib/constants/colors";

/**
 * Personal festival progress on Home while the festival is live. Solo users
 * (no group this festival, no friends) get it expanded, since they have no
 * feed; social users get a one-line summary that expands on tap.
 */
export function PersonalProgressCard() {
  const { t } = useTranslation();
  const { currentFestival } = useFestival();
  const countdown = useFestivalCountdown(currentFestival);
  const { data: highlights } = useHighlights(currentFestival?.id);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!currentFestival || countdown?.phase !== "live" || !highlights?.progress) {
    return null;
  }

  const { progress } = highlights;
  const title = t("home.progress.title", { festivalName: currentFestival.name });

  if (highlights.totalDays === 0) {
    if (!progress.isSolo) {
      return null;
    }
    const previous = progress.previousFestival;
    return (
      <Card size="md" variant="elevated" className="p-4">
        <VStack space="xs">
          <Text className="text-base font-semibold text-typography-900">
            {t("home.progress.firstDayNudge")}
          </Text>
          {previous && previous.beers > 0 && (
            <Text className="text-sm text-typography-500">
              {t("home.festivalStatus.lastTime", {
                festivalName: previous.name,
                beers: previous.beers,
                days: previous.days,
              })}
            </Text>
          )}
        </VStack>
      </Card>
    );
  }

  const lines = getProgressLines(progress, highlights.totalBeers);

  if (progress.isSolo) {
    return (
      <Card size="md" variant="elevated" className="p-4">
        <VStack space="sm">
          <Text className="text-base font-bold text-typography-900">{title}</Text>
          <Text className="text-sm text-typography-700">
            {t("home.progress.totals", {
              count: highlights.totalDays,
              beers: highlights.totalBeers,
            })}
          </Text>
          {lines.map((line) => (
            <Text key={line.id} className="text-sm text-typography-700">
              {t(line.key, line.params)}
            </Text>
          ))}
        </VStack>
      </Card>
    );
  }

  if (lines.length === 0) {
    return null;
  }

  const summary = lines.map((line) => t(line.key, line.params)).join(" · ");

  return (
    <Pressable
      onPress={() => setIsExpanded((wasExpanded) => !wasExpanded)}
      accessibilityRole="button"
      accessibilityLabel={t("home.progress.expandLabel")}
      accessibilityHint={t("home.progress.expandHint")}
      accessibilityState={{ expanded: isExpanded }}
    >
      <Card size="md" variant="elevated" className="p-3">
        <HStack space="sm" className="items-center justify-between">
          <VStack className="flex-1">
            <Text className="text-sm font-semibold text-typography-900">{title}</Text>
            {!isExpanded && (
              <Text className="text-sm text-typography-500" numberOfLines={1}>
                {summary}
              </Text>
            )}
          </VStack>
          {isExpanded ? (
            <ChevronUp size={16} color={IconColors.muted} />
          ) : (
            <ChevronDown size={16} color={IconColors.muted} />
          )}
        </HStack>
        {isExpanded && (
          <VStack space="xs" className="mt-2">
            {lines.map((line) => (
              <Text key={line.id} className="text-sm text-typography-700">
                {t(line.key, line.params)}
              </Text>
            ))}
          </VStack>
        )}
      </Card>
    </Pressable>
  );
}
