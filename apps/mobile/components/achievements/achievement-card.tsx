import { Badge, BadgeText } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useTranslation } from "@prostcounter/shared/i18n";
import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { View } from "react-native";

import type {
  AchievementRarity,
  AchievementWithProgress,
} from "@prostcounter/shared/schemas";

import { AchievementProgressBar } from "./achievement-progress-bar";

// Icon mapping from achievement icon key to emoji
const ICON_MAP: Record<string, string> = {
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
};

// Rarity styling configuration
const RARITY_STYLES: Record<
  AchievementRarity,
  { bg: string; text: string; border: string }
> = {
  common: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-300",
  },
  rare: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-300",
  },
  epic: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-300",
  },
  legendary: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    border: "border-yellow-300",
  },
};

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  consumption: "Beer",
  attendance: "Days",
  explorer: "Explorer",
  social: "Social",
  competitive: "Compete",
  special: "Special",
};

interface AchievementCardProps {
  achievement: AchievementWithProgress;
  showProgress?: boolean;
}

/**
 * Achievement card displaying name, description, icon, rarity, points, and progress
 */
export function AchievementCard({
  achievement,
  showProgress = true,
}: AchievementCardProps) {
  const { t } = useTranslation();
  const {
    name,
    description,
    category,
    rarity,
    points,
    icon,
    is_unlocked,
    unlocked_at,
    user_progress,
  } = achievement;

  const displayIcon = ICON_MAP[icon] || "🏆";
  const rarityStyle = RARITY_STYLES[rarity];
  const categoryLabel = CATEGORY_LABELS[category] || category;

  // Format unlock date
  const formattedUnlockDate = useMemo(() => {
    if (!unlocked_at) return null;
    try {
      return format(parseISO(unlocked_at), "MMM d, yyyy HH:mm");
    } catch {
      return null;
    }
  }, [unlocked_at]);

  return (
    <Card
      variant="outline"
      size="sm"
      className={
        is_unlocked
          ? "border-green-200 bg-green-50"
          : "border-gray-200 bg-white"
      }
    >
      <VStack space="sm" className="p-3">
        {/* Header: Icon + Name/Description + Rarity */}
        <HStack space="sm" className="items-start">
          {/* Icon */}
          <View
            className={`items-center justify-center rounded-lg p-2 ${
              is_unlocked ? "bg-green-100" : "bg-gray-100"
            }`}
          >
            <Text className="text-2xl">{displayIcon}</Text>
          </View>

          {/* Name and Description */}
          <VStack className="flex-1" space="xs">
            <Text
              className={`text-base font-semibold ${
                is_unlocked ? "text-green-800" : "text-gray-700"
              }`}
            >
              {name}
            </Text>
            <Text className="text-typography-500 text-sm" numberOfLines={2}>
              {description}
            </Text>
          </VStack>

          {/* Rarity Badge */}
          <View
            className={`rounded-md px-2 py-1 ${rarityStyle.bg} ${rarityStyle.border} border`}
          >
            <Text
              className={`text-xs font-medium capitalize ${rarityStyle.text}`}
            >
              {rarity}
            </Text>
          </View>
        </HStack>

        {/* Footer: Category, Points, Progress */}
        <HStack className="items-center justify-between">
          <HStack space="sm" className="items-center">
            {/* Category Badge */}
            <Badge action="muted" variant="outline" size="sm">
              <BadgeText className="normal-case">{categoryLabel}</BadgeText>
            </Badge>

            {/* Points */}
            <Text className="text-typography-600 text-sm">
              {points} {t("achievements.points")}
            </Text>
          </HStack>

          {/* Unlock status or Progress */}
          {is_unlocked ? (
            <HStack space="xs" className="items-center">
              <Text className="text-sm text-green-600">✓</Text>
              {formattedUnlockDate && (
                <Text className="text-xs text-green-600">
                  {formattedUnlockDate}
                </Text>
              )}
            </HStack>
          ) : (
            user_progress &&
            showProgress && (
              <View className="w-24">
                <AchievementProgressBar
                  progress={user_progress}
                  showLabel={false}
                />
                <Text className="text-typography-400 mt-1 text-center text-xs">
                  {Math.round(user_progress.percentage)}%
                </Text>
              </View>
            )
          )}
        </HStack>
      </VStack>
    </Card>
  );
}

AchievementCard.displayName = "AchievementCard";
