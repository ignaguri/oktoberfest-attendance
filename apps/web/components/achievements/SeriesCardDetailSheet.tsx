"use client";

import type { AchievementTier } from "@prostcounter/shared/achievements";
import { getActiveTier, TIER_NAMES } from "@prostcounter/shared/achievements";
import type { SeriesCard as SeriesCardData } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface SeriesCardDetailSheetProps {
  card: SeriesCardData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Every rung of one card: which are earned, when, and how far the next one is. */
export function SeriesCardDetailSheet({ card, open, onOpenChange }: SeriesCardDetailSheetProps) {
  const { t } = useTranslation();
  const activeTier = getActiveTier(card);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(activeTier.name)}
      description={t(`achievements.categories.${card.category}`)}
    >
      <div className="space-y-2 px-4 pb-4 md:px-0 md:pb-0">
        {card.tiers.map((tier) => {
          // Only a series has a "next" rung; a one-off's single rung carries a
          // difficulty tier that never lines up with currentTier + 1.
          const isNextRung = !tier.isUnlocked && tier.tier === card.currentTier + 1;

          return (
            <div
              key={tier.tier}
              className={cn(
                "flex items-start justify-between gap-3 rounded-md border p-3",
                tier.isUnlocked ? "border-green-200 bg-green-50/30" : "border-gray-200",
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">{t(tier.name)}</p>
                <p className="text-xs text-gray-600">
                  {t(`achievements.tiers.${TIER_NAMES[tier.tier as AchievementTier]}`)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {tier.isUnlocked && tier.unlockedAt !== null ? (
                  <p className="text-xs text-green-700">
                    {t("achievements.unlockedOn", {
                      date: formatLocalized(new Date(tier.unlockedAt), "MMM d, yyyy"),
                    })}
                  </p>
                ) : isNextRung && card.progress != null ? (
                  <p className="text-xs text-gray-600">
                    {t("achievements.progressToNext", {
                      current: card.progress.currentValue,
                      target: card.progress.nextTarget,
                      remaining: card.progress.nextTarget - card.progress.currentValue,
                    })}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">{t("achievements.locked")}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ResponsiveDialog>
  );
}
