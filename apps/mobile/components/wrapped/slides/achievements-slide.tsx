import { Motion } from "@legendapp/motion";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import {
  calculateTotalPoints,
  RARITY_COLORS,
  sortAchievements,
} from "@prostcounter/shared/wrapped";
import { useMemo } from "react";
import { View } from "react-native";

import { ICON_MAP } from "@/components/achievements/achievement-card";
import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { BaseSlide, SlideSubtitle, SlideTitle, StatItem } from "./base-slide";

interface AchievementsSlideProps {
  data: WrappedData;
  isActive: boolean;
}

export function AchievementsSlide({ data, isActive }: AchievementsSlideProps) {
  const { t } = useTranslation();

  const sorted = useMemo(
    () => sortAchievements(data.achievements).slice(0, 6),
    [data.achievements],
  );

  const totalPoints = useMemo(
    () => calculateTotalPoints(data.achievements),
    [data.achievements],
  );

  return (
    <BaseSlide isActive={isActive} backgroundClassName="bg-yellow-50">
      <VStack space="lg" className="flex-1 justify-center">
        <SlideTitle isActive={isActive}>
          {t("wrapped.achievements.title")}
        </SlideTitle>
        <SlideSubtitle isActive={isActive}>
          {t("wrapped.achievements.subtitle")}
        </SlideSubtitle>

        <StatItem
          label={t("wrapped.achievements.totalPoints")}
          value={String(totalPoints)}
          isActive={isActive}
          delay={200}
        />

        <VStack space="sm" className="mt-2 w-full max-w-xs self-center">
          {sorted.map((achievement, index) => (
            <Motion.View
              key={achievement.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: isActive ? 1 : 0,
                opacity: isActive ? 1 : 0,
              }}
              transition={{
                type: "spring",
                damping: 12,
                stiffness: 120,
                delay: 400 + index * 120,
              }}
              className="flex-row items-center rounded-xl bg-white/70 px-4 py-3"
            >
              <View style={{ width: 36, alignItems: "center" }}>
                <Text className="text-2xl">
                  {ICON_MAP[achievement.icon] || "🏆"}
                </Text>
              </View>
              <VStack space="xs" className="ml-2 flex-1">
                <Text className="text-sm font-semibold text-gray-800">
                  {t(achievement.name, { defaultValue: achievement.name })}
                </Text>
                <HStack space="sm" className="items-center">
                  <View
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        RARITY_COLORS[achievement.rarity] ||
                        RARITY_COLORS.common,
                    }}
                  />
                  <Text className="text-xs capitalize text-gray-500">
                    {t(`achievements.rarity.${achievement.rarity}`)}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {achievement.points} {t("achievements.points")}
                  </Text>
                </HStack>
              </VStack>
            </Motion.View>
          ))}
        </VStack>
      </VStack>
    </BaseSlide>
  );
}
