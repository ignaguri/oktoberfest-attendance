"use client";

import type { AchievementCategory, AchievementTier } from "@prostcounter/shared/achievements";
import {
  getCategoryColor,
  glyphSizePx,
  TIER_RING_WIDTH,
} from "@prostcounter/shared/achievements";
import { useTranslation } from "@/lib/i18n/client";
import type { AchievementRarity } from "@/lib/types/achievements";
import { cn } from "@/lib/utils";

import { GlyphIcon } from "./GlyphIcon";

/** `xl` exists for the detail sheet's hero badge; the lists use sm..lg. */
type BadgeSize = "sm" | "md" | "lg" | "xl";

interface AchievementBadgeProps {
  name: string;
  icon: string;
  category?: AchievementCategory;
  tier?: AchievementTier;
  rarity: AchievementRarity;
  points: number;
  isUnlocked: boolean;
  size?: BadgeSize;
  showPoints?: boolean;
  className?: string;
}


const SIZE_PX: Record<BadgeSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 96,
};

export function AchievementBadge({
  name,
  icon,
  category,
  tier,
  points,
  isUnlocked,
  size = "md",
  showPoints = false,
  className,
}: AchievementBadgeProps) {
  const { t } = useTranslation();

  const translatedName = t(name);
  const diameter = SIZE_PX[size];
  const strokeWidth = tier !== undefined ? TIER_RING_WIDTH[tier] : TIER_RING_WIDTH[1];
  const ringColor = category !== undefined ? getCategoryColor(category) : getCategoryColor("");
  const glowsForTier = tier !== undefined && tier >= 3;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className="relative inline-flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: diameter,
          height: diameter,
          border: `${strokeWidth}px solid ${ringColor}`,
          opacity: isUnlocked ? 1 : 0.6,
          boxShadow: glowsForTier ? `0 0 8px ${ringColor}` : undefined,
        }}
      >
        <GlyphIcon glyph={icon} sizePx={glyphSizePx(diameter)} />
      </span>

      {name !== "" && <span className="truncate text-sm">{translatedName}</span>}

      {showPoints && <span className="ml-1 text-xs font-normal opacity-75">{points}pts</span>}
    </span>
  );
}
