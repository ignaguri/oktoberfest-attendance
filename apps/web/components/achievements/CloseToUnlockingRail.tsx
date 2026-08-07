"use client";

import type { AchievementTier } from "@prostcounter/shared/achievements";
import {
  getActiveTier,
  selectCloseToUnlocking,
  tierToRarity,
} from "@prostcounter/shared/achievements";
import type { SeriesCard as SeriesCardData } from "@prostcounter/shared/schemas";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "@/lib/i18n/client";

import { AchievementBadge } from "./AchievementBadge";

interface CloseToUnlockingRailProps {
  cards: SeriesCardData[];
}

/**
 * The three series nearest their next rung. Renders nothing at all when
 * nothing qualifies — an empty rail is dead space, and a new user or an
 * untouched scope legitimately has none.
 */
export function CloseToUnlockingRail({ cards }: CloseToUnlockingRailProps) {
  const { t } = useTranslation();
  const entries = selectCloseToUnlocking(cards);

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{t("achievements.closeToUnlocking")}</h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {entries.map(({ card, currentValue, nextTarget, remaining, percentage }) => {
          const activeTier = getActiveTier(card);

          return (
            <Card key={card.id} className="border-yellow-200 bg-yellow-50/30">
              <CardContent className="flex items-center gap-3 p-4">
                <AchievementBadge
                  name=""
                  icon={card.glyph}
                  category={card.category}
                  tier={activeTier.tier as AchievementTier}
                  rarity={tierToRarity(activeTier.tier)}
                  points={activeTier.points}
                  isUnlocked={card.currentTier > 0}
                  size="md"
                />

                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {t(activeTier.name)}
                  </p>
                  <Progress value={percentage} />
                  <p className="text-xs text-gray-600">
                    {t("achievements.progressToNext", {
                      current: currentValue,
                      target: nextTarget,
                      remaining,
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
