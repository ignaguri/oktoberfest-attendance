"use client";

import type { AchievementCategory, AchievementTier, GlyphId } from "@prostcounter/shared/achievements";
import { getCategoryColor, TIER_RING_WIDTH } from "@prostcounter/shared/achievements";
import { useState } from "react";

import { useTranslation } from "@/lib/i18n/client";
import type { AchievementRarity } from "@/lib/types/achievements";
import { cn } from "@/lib/utils";

import { GlyphIcon } from "./GlyphIcon";

interface AchievementBadgeProps {
  name: string;
  icon: string;
  category?: AchievementCategory;
  tier?: AchievementTier;
  rarity: AchievementRarity;
  points: number;
  isUnlocked: boolean;
  size?: "sm" | "md" | "lg";
  showPoints?: boolean;
  className?: string;
}

const SIZE_PX: Record<"sm" | "md" | "lg", number> = {
  sm: 32,
  md: 40,
  lg: 56,
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
  const [failedIcon, setFailedIcon] = useState<string | null>(null);
  const imageFailed = failedIcon === icon;

  const translatedName = t(name);
  const diameter = SIZE_PX[size];
  const strokeWidth = tier !== undefined ? TIER_RING_WIDTH[tier] : TIER_RING_WIDTH[1];
  const ringColor = category !== undefined ? getCategoryColor(category) : getCategoryColor("");
  const glowsForTier = tier !== undefined && tier >= 3;
  const imagePath = `/achievements/glyphs/${icon}.png`;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className="relative inline-flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: diameter,
          height: diameter,
          border: `${strokeWidth}px solid ${ringColor}`,
          opacity: isUnlocked ? 1 : 0.4,
          boxShadow: glowsForTier ? `0 0 8px ${ringColor}` : undefined,
        }}
      >
        {!imageFailed ? (
          // eslint-disable-next-line nextjs/no-img-element -- dynamic, possibly-missing static asset; next/image requires a known-good src
          <img
            src={imagePath}
            alt=""
            width={diameter * 0.6}
            height={diameter * 0.6}
            onError={() => setFailedIcon(icon)}
          />
        ) : (
          <GlyphIcon glyph={icon as GlyphId} sizePx={diameter * 0.5} />
        )}
      </span>

      {name !== "" && <span className="truncate text-sm">{translatedName}</span>}

      {showPoints && (
        <span className="ml-1 text-xs font-normal opacity-75">{points}pts</span>
      )}
    </span>
  );
}
