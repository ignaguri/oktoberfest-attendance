import type { AchievementTier } from "@prostcounter/shared/achievements";
import { getActiveTier, TIER_NAMES } from "@prostcounter/shared/achievements";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { SeriesCard as SeriesCardData } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "@/components/ui/actionsheet";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

interface SeriesCardDetailSheetProps {
  card: SeriesCardData;
  isOpen: boolean;
  onClose: () => void;
}

/** Every rung of one card: which are earned, when, and how far the next one is. */
export function SeriesCardDetailSheet({ card, isOpen, onClose }: SeriesCardDetailSheetProps) {
  const { t } = useTranslation();
  const activeTier = getActiveTier(card);

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="bg-background-0 pb-8">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="md" className="w-full px-4 py-4">
          <VStack space="xs">
            <Heading size="lg" className="text-typography-900">
              {t(activeTier.name)}
            </Heading>
            <Text className="text-sm text-typography-500">
              {t(`achievements.categories.${card.category}`)}
            </Text>
          </VStack>

          <VStack space="sm">
            {card.tiers.map((tier) => {
              // Only a series has a "next" rung; a one-off's single rung carries
              // a difficulty tier that never lines up with currentTier + 1.
              const isNextRung = !tier.isUnlocked && tier.tier === card.currentTier + 1;

              return (
                <HStack
                  key={tier.tier}
                  space="sm"
                  className={cn(
                    "items-start justify-between rounded-md border p-3",
                    tier.isUnlocked ? "border-green-200 bg-green-50/30" : "border-gray-200",
                  )}
                >
                  <VStack className="flex-1" space="xs">
                    <Text className="text-sm font-medium text-typography-900" numberOfLines={1}>
                      {t(tier.name)}
                    </Text>
                    <Text className="text-xs text-typography-500">
                      {t(`achievements.tiers.${TIER_NAMES[tier.tier as AchievementTier]}`)}
                    </Text>
                  </VStack>

                  {tier.isUnlocked && tier.unlockedAt !== null ? (
                    <Text className="text-xs text-green-700">
                      {t("achievements.unlockedOn", {
                        date: formatLocalized(new Date(tier.unlockedAt), "MMM d, yyyy"),
                      })}
                    </Text>
                  ) : isNextRung && card.progress != null ? (
                    <Text className="text-xs text-typography-500">
                      {t("achievements.progressToNext", {
                        current: card.progress.currentValue,
                        target: card.progress.nextTarget,
                        remaining: card.progress.nextTarget - card.progress.currentValue,
                      })}
                    </Text>
                  ) : (
                    <Text className="text-xs text-typography-400">{t("achievements.locked")}</Text>
                  )}
                </HStack>
              );
            })}
          </VStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}

SeriesCardDetailSheet.displayName = "SeriesCardDetailSheet";
