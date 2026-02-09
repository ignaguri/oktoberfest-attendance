import { Motion } from "@legendapp/motion";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { getBestGlobalPosition } from "@prostcounter/shared/wrapped";
import { useMemo } from "react";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { BaseSlide, SlideSubtitle, SlideTitle, StatItem } from "./base-slide";

interface RankingsSlideProps {
  data: WrappedData;
  isActive: boolean;
}

function getPositionEmoji(position: number): string {
  if (position === 1) return "\u{1F947}"; // gold medal
  if (position === 2) return "\u{1F948}"; // silver medal
  if (position === 3) return "\u{1F949}"; // bronze medal
  return `#${position}`;
}

export function RankingsSlide({ data, isActive }: RankingsSlideProps) {
  const { t } = useTranslation();

  const bestGlobal = useMemo(() => getBestGlobalPosition(data), [data]);

  return (
    <BaseSlide isActive={isActive} backgroundClassName="bg-sky-50">
      <VStack space="lg" className="flex-1 justify-center">
        <SlideTitle isActive={isActive}>
          {t("wrapped.rankings.title")}
        </SlideTitle>
        <SlideSubtitle isActive={isActive}>
          {t("wrapped.rankings.subtitle")}
        </SlideSubtitle>

        {/* Group rankings */}
        {data.social_stats.top_3_rankings.length > 0 && (
          <VStack space="sm" className="mt-4">
            <Motion.View
              initial={{ opacity: 0 }}
              animate={{ opacity: isActive ? 1 : 0 }}
              transition={{ type: "timing", duration: 300, delay: 200 }}
            >
              <Text className="text-center text-sm font-semibold text-gray-600">
                {t("wrapped.rankings.groupRankings")}
              </Text>
            </Motion.View>

            {data.social_stats.top_3_rankings.map((ranking, index) => (
              <Motion.View
                key={ranking.group_name}
                initial={{ opacity: 0, x: -30 }}
                animate={{
                  opacity: isActive ? 1 : 0,
                  x: isActive ? 0 : -30,
                }}
                transition={{
                  type: "timing",
                  duration: 400,
                  delay: 300 + index * 150,
                }}
                style={{ overflow: "visible" }}
                className="flex-row items-center justify-between rounded-xl bg-white/70 px-4 py-3"
              >
                <HStack space="sm" className="flex-1 items-center">
                  <Text className="text-2xl">
                    {getPositionEmoji(ranking.position)}
                  </Text>
                  <Text
                    className="flex-1 text-base text-gray-700"
                    numberOfLines={1}
                  >
                    {ranking.group_name}
                  </Text>
                </HStack>
                <Text className="text-sm font-semibold text-sky-600">
                  #{ranking.position}
                </Text>
              </Motion.View>
            ))}
          </VStack>
        )}

        {/* Global position */}
        {bestGlobal && (
          <View className="mt-2">
            <StatItem
              label={t("wrapped.rankings.globalRankings")}
              value={`#${bestGlobal.position}`}
              isActive={isActive}
              delay={600}
            />
          </View>
        )}
      </VStack>
    </BaseSlide>
  );
}
