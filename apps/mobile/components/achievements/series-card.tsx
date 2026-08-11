import type { AchievementTier, GlyphId } from "@prostcounter/shared/achievements";
import {
  getActiveTier,
  getCategoryColor,
  LOCKED_PIP_COLOR,
  TIER_NAMES,
} from "@prostcounter/shared/achievements";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { SeriesCard as SeriesCardData } from "@prostcounter/shared/schemas";
import { cn } from "@prostcounter/ui";
import { useState } from "react";
import { View } from "react-native";

import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Pressable } from "@/components/ui/pressable";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { AchievementBadge } from "./achievement-badge";
import { SeriesCardDetailSheet } from "./series-card-detail-sheet";

interface SeriesCardProps {
  card: SeriesCardData;
}

/**
 * One achievement series (or one-off) as a single card: badge, the active
 * tier's name, its tier label, and one pip per rung.
 */
export function SeriesCard({ card }: SeriesCardProps) {
  const { t } = useTranslation();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Never card.currentTier: that counts rungs cleared, which is not the badge
  // tier for a one-off. See getActiveTier's doc comment.
  const activeTier = getActiveTier(card);
  const isUnlocked = card.currentTier > 0;
  const categoryColor = getCategoryColor(card.category);

  return (
    <>
      <Pressable
        onPress={() => setIsDetailOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t(activeTier.name)}
        accessibilityHint={t("achievements.viewProgress")}
      >
        <Card
          variant="outline"
          size="sm"
          className={cn(
            isUnlocked ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-white",
          )}
        >
          <HStack space="sm" className="items-center p-3">
            <AchievementBadge
              glyph={card.glyph as GlyphId}
              category={card.category}
              tier={activeTier.tier as AchievementTier}
              isUnlocked={isUnlocked}
              size="md"
            />

            <VStack className="flex-1" space="xs">
              <Text
                className={cn(
                  "text-base font-semibold",
                  isUnlocked ? "text-green-800" : "text-gray-700",
                )}
                numberOfLines={1}
              >
                {t(activeTier.name)}
              </Text>
              <Text className="text-xs text-typography-500">
                {isUnlocked
                  ? t(`achievements.tiers.${TIER_NAMES[activeTier.tier as AchievementTier]}`)
                  : t("achievements.locked")}
              </Text>
            </VStack>

            {/* Decorative: the tier label above already says this in words. The
                per-category colour is data, so it cannot be a NativeWind class —
                same reason achievement-badge.tsx styles its glow inline. */}
            <HStack space="xs" className="items-center" accessibilityElementsHidden>
              {card.tiers.map((tier) => (
                <View
                  key={tier.tier}
                  className="h-2 w-2 rounded-full border"
                  style={{
                    backgroundColor: tier.isUnlocked ? categoryColor : "transparent",
                    borderColor: tier.isUnlocked ? categoryColor : LOCKED_PIP_COLOR,
                  }}
                />
              ))}
            </HStack>
          </HStack>
        </Card>
      </Pressable>

      <SeriesCardDetailSheet
        card={card}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </>
  );
}

SeriesCard.displayName = "SeriesCard";
