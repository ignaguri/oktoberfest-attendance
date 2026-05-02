"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/client";
import type { AchievementRarity } from "@/lib/types/achievements";
import { cn } from "@/lib/utils";

const rarityConfig = {
  common: {
    bgColor: "bg-gray-100 hover:bg-gray-200",
    textColor: "text-gray-800",
    borderColor: "border-gray-300",
    variant: "outline" as const,
  },
  rare: {
    bgColor: "bg-blue-100 hover:bg-blue-200",
    textColor: "text-blue-800",
    borderColor: "border-blue-300",
    variant: "secondary" as const,
  },
  epic: {
    bgColor: "bg-purple-100 hover:bg-purple-200",
    textColor: "text-purple-800",
    borderColor: "border-purple-300",
    variant: "default" as const,
  },
  legendary: {
    bgColor: "bg-yellow-100 hover:bg-yellow-200",
    textColor: "text-yellow-800",
    borderColor: "border-yellow-300",
    variant: "default" as const,
  },
} as const;

const iconMap = {
  // Consumption
  first_beer: "🍺",
  beer_mug: "🍺",
  beer_bottle: "🍻",
  beer_cheers: "🍻",
  trophy: "🏆",
  fire: "🔥",
  lightning: "⚡",

  // Attendance
  wave: "👋",
  calendar: "📅",
  star: "⭐",
  crown: "👑",
  flame: "🔥",
  weekend: "🎉",
  sunrise: "🌅",

  // Explorer
  tent: "⛺",
  map: "🗺️",
  compass: "🧭",
  guide: "🗺️",
  master: "🎯",

  // Social
  handshake: "🤝",
  butterfly: "🦋",
  leader: "🚀",
  medal: "🥇",
  podium: "🏆",
  camera: "📸",
  photo_album: "📚",

  // Competitive
  competition: "🏁",
  rising_star: "🌟",
  legend: "👑",
  multi_trophy: "🏆",

  // Special
  veteran: "🎖️",
  multi_year: "🎖️",
  money_bag: "💰",
  consistency: "📊",
  perfect: "💯",
  first_day: "🎯",
  closing: "🎊",
} as const;

interface AchievementBadgeProps {
  name: string;
  icon: string;
  rarity: AchievementRarity;
  points: number;
  isUnlocked: boolean;
  size?: "sm" | "md" | "lg";
  showPoints?: boolean;
  className?: string;
}

export function AchievementBadge({
  name,
  icon,
  rarity,
  points,
  isUnlocked,
  size = "md",
  showPoints = false,
  className,
}: AchievementBadgeProps) {
  const { t } = useTranslation();
  const config = rarityConfig[rarity];
  const displayIcon = iconMap[icon as keyof typeof iconMap] || "🏆";

  // Achievement name is stored as an i18n key, so translate it
  const translatedName = t(name, { defaultValue: name });

  const sizeStyles = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-2",
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "inline-flex items-center gap-1.5 font-medium transition-colors",
        sizeStyles[size],
        isUnlocked
          ? `${config.bgColor} ${config.textColor} ${config.borderColor}`
          : "border-gray-200 bg-gray-50 text-gray-400 opacity-60",
        className,
      )}
    >
      <span className={cn("text-base", size === "sm" && "text-sm")}>{displayIcon}</span>

      <span className="truncate">{translatedName}</span>

      {showPoints && (
        <span className={cn("ml-1 text-xs font-normal opacity-75", size === "sm" && "text-xs")}>
          {points}pts
        </span>
      )}
    </Badge>
  );
}
