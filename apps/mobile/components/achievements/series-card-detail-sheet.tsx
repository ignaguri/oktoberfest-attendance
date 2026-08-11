import type { AchievementTier, GlyphId } from "@prostcounter/shared/achievements";
import {
  getActiveTier,
  getCategoryColor,
  LOCKED_PIP_COLOR,
  TIER_NAMES,
} from "@prostcounter/shared/achievements";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { SeriesCard as SeriesCardData, SeriesTier } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";
import { cn } from "@prostcounter/ui";
import { View } from "react-native";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from "@/components/ui/actionsheet";
import { Heading } from "@/components/ui/heading";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { AchievementBadge } from "./achievement-badge";

interface SeriesCardDetailSheetProps {
  card: SeriesCardData;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * One pip per level of this rung — bronze gets one, platinum four — filled
 * when the rung is earned. Decorative: it sits beside the tier label, which
 * already says the same thing in words, so it stays out of the a11y tree.
 *
 * The category colour is data, so it cannot be a NativeWind class — same
 * reason series-card.tsx styles its pips inline.
 */
function TierLevelPips({ tier, categoryColor }: { tier: SeriesTier; categoryColor: string }) {
  return (
    <HStack space="xs" className="items-center" accessibilityElementsHidden>
      {Array.from({ length: tier.tier }, (_unused, index) => (
        <View
          key={index}
          className="h-2 w-2 rounded-full border"
          style={{
            backgroundColor: tier.isUnlocked ? categoryColor : "transparent",
            borderColor: tier.isUnlocked ? categoryColor : LOCKED_PIP_COLOR,
          }}
        />
      ))}
    </HStack>
  );
}

/** Every rung of one card: which are earned, when, and how far the next one is. */
export function SeriesCardDetailSheet({ card, isOpen, onClose }: SeriesCardDetailSheetProps) {
  const { t } = useTranslation();
  const activeTier = getActiveTier(card);
  const isUnlocked = card.currentTier > 0;
  const categoryColor = getCategoryColor(card.category);

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      {/* Capped and scrollable, like every other sheet in the app: the hero
          badge plus four rungs runs past a short screen (and well past one at
          an accessibility text size), and an uncapped ActionsheetContent is
          positioned from the bottom, so the overflow slides off the TOP —
          taking the drag indicator and the badge with it, unreachable. */}
      <ActionsheetContent className="max-h-[85%] bg-background-0 pb-8">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView className="w-full">
          <VStack space="md" className="w-full px-4 py-4">
            {/* The glyph at a size worth looking at — the list behind this sheet
                only ever shows it at 40px. */}
            <VStack space="xs" className="items-center">
              <AchievementBadge
                glyph={card.glyph as GlyphId}
                category={card.category}
                tier={activeTier.tier as AchievementTier}
                isUnlocked={isUnlocked}
                size="xl"
              />
              <Heading size="lg" className="text-center text-typography-900">
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
                const status =
                  tier.isUnlocked && tier.unlockedAt !== null
                    ? {
                        text: t("achievements.unlockedOn", {
                          date: formatLocalized(new Date(tier.unlockedAt), "MMM d, yyyy"),
                        }),
                        className: "text-green-700",
                      }
                    : isNextRung && card.progress != null
                      ? {
                          text: t("achievements.progressToNext", {
                            current: card.progress.currentValue,
                            target: card.progress.nextTarget,
                            remaining: card.progress.nextTarget - card.progress.currentValue,
                          }),
                          className: "text-typography-500",
                        }
                      : { text: t("achievements.locked"), className: "text-typography-400" };

                return (
                  <VStack
                    key={tier.tier}
                    space="xs"
                    className={cn(
                      "rounded-md border p-3",
                      tier.isUnlocked ? "border-green-200 bg-green-50/30" : "border-gray-200",
                    )}
                  >
                    <HStack space="sm" className="items-start justify-between">
                      <Text
                        className="flex-1 text-sm font-medium text-typography-900"
                        numberOfLines={1}
                      >
                        {t(tier.name)}
                      </Text>

                      {/* Capped so it cannot starve the name: the name is
                          flex-1 (basis 0) while this is sized to content, so
                          without a cap a long date at a large text size takes
                          the whole row and the name renders at zero width. */}
                      <Text className={cn("max-w-[55%] text-right text-xs", status.className)}>
                        {status.text}
                      </Text>
                    </HStack>

                    <HStack space="xs" className="items-center">
                      <Text className="text-xs text-typography-500">
                        {t(`achievements.tiers.${TIER_NAMES[tier.tier as AchievementTier]}`)}
                      </Text>
                      <TierLevelPips tier={tier} categoryColor={categoryColor} />
                    </HStack>
                  </VStack>
                );
              })}
            </VStack>
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

SeriesCardDetailSheet.displayName = "SeriesCardDetailSheet";
