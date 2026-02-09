import { Motion } from "@legendapp/motion";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { getTopTents } from "@prostcounter/shared/wrapped";
import { useMemo } from "react";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { BaseSlide, SlideSubtitle, SlideTitle, StatItem } from "./base-slide";

interface TentExplorerSlideProps {
  data: WrappedData;
  isActive: boolean;
}

export function TentExplorerSlide({ data, isActive }: TentExplorerSlideProps) {
  const { t } = useTranslation();

  const topTents = useMemo(
    () => getTopTents(data.tent_stats.tent_breakdown, 3),
    [data.tent_stats.tent_breakdown],
  );

  return (
    <BaseSlide isActive={isActive} backgroundClassName="bg-green-50">
      <VStack space="lg" className="flex-1 justify-center">
        <SlideTitle isActive={isActive}>
          {t("wrapped.tentExplorer.title")}
        </SlideTitle>
        <SlideSubtitle isActive={isActive}>
          {t("wrapped.tentExplorer.subtitle")}
        </SlideSubtitle>

        <View className="mt-4">
          <HStack space="md">
            <View className="flex-1">
              <StatItem
                label={t("wrapped.tentExplorer.uniqueTents")}
                value={String(data.tent_stats.unique_tents)}
                isActive={isActive}
                delay={200}
              />
            </View>
            <View className="flex-1">
              <StatItem
                label={t("wrapped.tentExplorer.diversity")}
                value={`${data.tent_stats.tent_diversity_pct.toFixed(0)}%`}
                isActive={isActive}
                delay={350}
              />
            </View>
          </HStack>
        </View>

        {data.tent_stats.favorite_tent && (
          <Motion.View
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 20 }}
            transition={{ type: "timing", duration: 400, delay: 500 }}
            className="items-center rounded-2xl bg-white/70 p-4"
          >
            <Text className="text-sm text-gray-500">
              {t("wrapped.tentExplorer.favorite")}
            </Text>
            <Text className="mt-1 text-xl font-bold text-gray-800">
              {data.tent_stats.favorite_tent}
            </Text>
          </Motion.View>
        )}

        {/* Top tents list */}
        <VStack space="sm" className="mt-2">
          {topTents.map((tent, index) => (
            <Motion.View
              key={tent.tent_name}
              initial={{ opacity: 0, x: -30 }}
              animate={{
                opacity: isActive ? 1 : 0,
                x: isActive ? 0 : -30,
              }}
              transition={{
                type: "timing",
                duration: 400,
                delay: 600 + index * 150,
              }}
              className="flex-row items-center justify-between rounded-xl bg-white/50 px-4 py-3"
            >
              <HStack space="sm" className="items-center">
                <Text className="text-lg font-bold text-green-600">
                  #{index + 1}
                </Text>
                <Text className="text-base text-gray-700">
                  {tent.tent_name}
                </Text>
              </HStack>
              <Text className="text-sm text-gray-500">
                {tent.visit_count}{" "}
                {t("wrapped.tentExplorer.visits", { count: tent.visit_count })}
              </Text>
            </Motion.View>
          ))}
        </VStack>
      </VStack>
    </BaseSlide>
  );
}
