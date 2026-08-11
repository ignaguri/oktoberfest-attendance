"use client";

import { useState } from "react";

import type { AchievementTier } from "@prostcounter/shared/achievements";
import {
  getActiveTier,
  getCategoryColor,
  LOCKED_PIP_COLOR,
  TIER_NAMES,
  tierToRarity,
} from "@prostcounter/shared/achievements";
import type { SeriesCard as SeriesCardData } from "@prostcounter/shared/schemas";

import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

import { AchievementBadge } from "./AchievementBadge";
import { SeriesCardDetailSheet } from "./SeriesCardDetailSheet";

interface SeriesCardProps {
  card: SeriesCardData;
  className?: string;
}

export function SeriesCard({ card, className }: SeriesCardProps) {
  const { t } = useTranslation();
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Never card.currentTier: that counts rungs cleared, which is not the badge
  // tier for a one-off. See getActiveTier's doc comment.
  const activeTier = getActiveTier(card);
  const isUnlocked = card.currentTier > 0;
  const categoryColor = getCategoryColor(card.category);

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        onClick={() => setIsDetailOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsDetailOpen(true);
          }
        }}
        className={cn(
          "cursor-pointer transition-all duration-200 hover:shadow-md",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          isUnlocked ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-white",
          className,
        )}
      >
        <CardContent className="flex items-center gap-3 p-4">
          <AchievementBadge
            name=""
            icon={card.glyph}
            category={card.category}
            tier={activeTier.tier as AchievementTier}
            rarity={tierToRarity(activeTier.tier)}
            points={activeTier.points}
            isUnlocked={isUnlocked}
            size="md"
          />

          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-sm font-semibold",
                isUnlocked ? "text-green-800" : "text-gray-700",
              )}
            >
              {t(activeTier.name)}
            </p>
            <p className="text-xs text-gray-600">
              {isUnlocked
                ? t(`achievements.tiers.${TIER_NAMES[activeTier.tier as AchievementTier]}`)
                : t("achievements.locked")}
            </p>
          </div>

          {/* Decorative: the tier label above already says this in words. */}
          <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
            {card.tiers.map((tier) => (
              <span
                key={tier.tier}
                className="size-2 rounded-full border"
                style={{
                  backgroundColor: tier.isUnlocked ? categoryColor : "transparent",
                  borderColor: tier.isUnlocked ? categoryColor : LOCKED_PIP_COLOR,
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
      <SeriesCardDetailSheet card={card} open={isDetailOpen} onOpenChange={setIsDetailOpen} />
    </>
  );
}
