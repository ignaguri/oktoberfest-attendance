"use client";

import type { AchievementTier } from "@prostcounter/shared/achievements";
import {
  getActiveTier,
  getCategoryColor,
  LOCKED_PIP_COLOR,
  TIER_NAMES,
  tierToRarity,
} from "@prostcounter/shared/achievements";
import type { SeriesCard as SeriesCardData, SeriesTier } from "@prostcounter/shared/schemas";
import { formatLocalized } from "@prostcounter/shared/utils";

import ResponsiveDialog from "@/components/ResponsiveDialog";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

import { AchievementBadge } from "./AchievementBadge";

interface SeriesCardDetailSheetProps {
  card: SeriesCardData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * One pip per level of this rung — bronze gets one, platinum four — filled
 * when the rung is earned. Decorative: it sits beside the tier label, which
 * already says the same thing in words.
 */
function TierLevelPips({ tier, categoryColor }: { tier: SeriesTier; categoryColor: string }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: tier.tier }, (_unused, index) => (
        <span
          key={index}
          className="size-2 rounded-full border"
          style={{
            backgroundColor: tier.isUnlocked ? categoryColor : "transparent",
            borderColor: tier.isUnlocked ? categoryColor : LOCKED_PIP_COLOR,
          }}
        />
      ))}
    </span>
  );
}

/** Every rung of one card: which are earned, when, and how far the next one is. */
export function SeriesCardDetailSheet({ card, open, onOpenChange }: SeriesCardDetailSheetProps) {
  const { t } = useTranslation();
  const activeTier = getActiveTier(card);
  const isUnlocked = card.currentTier > 0;
  const categoryColor = getCategoryColor(card.category);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(activeTier.name)}
      description={t(`achievements.categories.${card.category}`)}
    >
      {/* Scrollable and capped: the hero badge plus four rungs runs past a
          short viewport, and neither DrawerContent (max-h-[80vh], no overflow
          rule) nor DialogContent (no max height at all) would let you reach
          the overflow — the drawer is bottom-anchored, so it paints off-screen.
          Same pattern as components/ui/datetime-picker.tsx. */}
      <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 pb-4 md:px-0 md:pb-0">
        {/* The glyph at a size worth looking at — the card behind this dialog
            only ever shows it at 40px. Below the heading rather than above it,
            because ResponsiveDialog owns the title and description. */}
        <div className="flex justify-center">
          <AchievementBadge
            name=""
            icon={card.glyph}
            category={card.category}
            tier={activeTier.tier as AchievementTier}
            rarity={tierToRarity(activeTier.tier)}
            points={activeTier.points}
            isUnlocked={isUnlocked}
            size="xl"
          />
        </div>

        <div className="space-y-2">
          {card.tiers.map((tier) => {
            // Only a series has a "next" rung; a one-off's single rung carries a
            // difficulty tier that never lines up with currentTier + 1.
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
                      className: "text-gray-600",
                    }
                  : { text: t("achievements.locked"), className: "text-gray-500" };

            return (
              <div
                key={tier.tier}
                className={cn(
                  "space-y-1 rounded-md border p-3",
                  tier.isUnlocked ? "border-green-200 bg-green-50/30" : "border-gray-200",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                    {t(tier.name)}
                  </p>

                  {/* Capped so it cannot starve the name, which is min-w-0 and
                      would otherwise collapse to zero width beside a long date
                      at a large browser font size. */}
                  <p className={cn("max-w-[55%] shrink-0 text-right text-xs", status.className)}>
                    {status.text}
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-gray-600">
                    {t(`achievements.tiers.${TIER_NAMES[tier.tier as AchievementTier]}`)}
                  </p>
                  <TierLevelPips tier={tier} categoryColor={categoryColor} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
