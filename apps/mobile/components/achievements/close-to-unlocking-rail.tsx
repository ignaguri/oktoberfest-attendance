import type { AchievementTier, GlyphId } from "@prostcounter/shared/achievements";
import { getActiveTier, selectCloseToUnlocking } from "@prostcounter/shared/achievements";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { SeriesCard as SeriesCardData } from "@prostcounter/shared/schemas";

import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Progress, ProgressFilledTrack } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { AchievementBadge } from "./achievement-badge";

interface CloseToUnlockingRailProps {
  cards: SeriesCardData[];
}

/**
 * The three series nearest their next rung. Renders nothing when nothing
 * qualifies — a new user, or a scope with no series started, legitimately has
 * none, and an empty section is dead space.
 */
export function CloseToUnlockingRail({ cards }: CloseToUnlockingRailProps) {
  const { t } = useTranslation();
  const entries = selectCloseToUnlocking(cards);

  if (entries.length === 0) {
    return null;
  }

  return (
    <VStack space="sm">
      <Heading size="md" className="text-typography-900">
        {t("achievements.closeToUnlocking")}
      </Heading>

      <VStack space="sm">
        {entries.map(({ card, currentValue, nextTarget, remaining, percentage }) => {
          const activeTier = getActiveTier(card);

          return (
            <Card
              key={card.id}
              variant="outline"
              size="sm"
              className="border-yellow-200 bg-yellow-50/30"
            >
              <HStack space="sm" className="items-center p-3">
                <AchievementBadge
                  glyph={card.glyph as GlyphId}
                  category={card.category}
                  tier={activeTier.tier as AchievementTier}
                  isUnlocked={card.currentTier > 0}
                  size="md"
                />

                <VStack className="flex-1" space="xs">
                  <Text className="text-base font-semibold text-typography-900" numberOfLines={1}>
                    {t(activeTier.name)}
                  </Text>
                  <Progress value={percentage} size="sm">
                    <ProgressFilledTrack />
                  </Progress>
                  <Text className="text-xs text-typography-500">
                    {t("achievements.progressToNext", {
                      current: currentValue,
                      target: nextTarget,
                      remaining,
                    })}
                  </Text>
                </VStack>
              </HStack>
            </Card>
          );
        })}
      </VStack>
    </VStack>
  );
}

CloseToUnlockingRail.displayName = "CloseToUnlockingRail";
