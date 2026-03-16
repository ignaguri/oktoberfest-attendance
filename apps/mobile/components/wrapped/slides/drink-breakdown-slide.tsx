import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { Beer } from "lucide-react-native";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { Colors } from "@/lib/constants/colors";

import { BaseSlide, SlideSubtitle, SlideTitle, StatItem } from "./base-slide";

interface DrinkBreakdownSlideProps {
  data: WrappedData;
  isActive: boolean;
}

export function DrinkBreakdownSlide({
  data,
  isActive,
}: DrinkBreakdownSlideProps) {
  const { t } = useTranslation();
  const breakdown = data.drink_stats?.breakdown?.slice(0, 4) ?? [];
  const topDrink = data.drink_stats?.top_drink_type;
  const totalDrinks = data.drink_stats?.total_drinks ?? 0;

  return (
    <BaseSlide isActive={isActive} backgroundClassName="bg-amber-50">
      <VStack space="lg" className="flex-1 justify-center">
        <SlideTitle isActive={isActive}>
          {t("wrapped.drinkBreakdown.title")}
        </SlideTitle>
        <SlideSubtitle isActive={isActive}>
          {t("wrapped.drinkBreakdown.subtitle")}
        </SlideSubtitle>

        <View className="mt-4">
          <VStack space="md">
            {topDrink && (
              <StatItem
                label={t("wrapped.drinkBreakdown.topDrink")}
                value={t(`wrapped.drinkBreakdown.drinkTypes.${topDrink}`)}
                icon={<Beer size={24} color={Colors.primary[500]} />}
                isActive={isActive}
                delay={200}
              />
            )}

            <View className="mt-2">
              <VStack space="sm">
                {breakdown.map((item, index) => (
                  <View
                    key={item.drink_type}
                    className="rounded-lg bg-white p-3 shadow-sm"
                  >
                    <View className="mb-1 flex-row items-center justify-between">
                      <Text className="text-sm font-medium text-gray-700">
                        {t(
                          `wrapped.drinkBreakdown.drinkTypes.${item.drink_type}`,
                        )}
                      </Text>
                      <Text className="text-sm font-bold text-amber-600">
                        {item.percentage}%
                      </Text>
                    </View>
                    <View className="h-2 rounded-full bg-amber-100">
                      <View
                        className="h-2 rounded-full bg-amber-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </View>
                  </View>
                ))}
              </VStack>
            </View>
          </VStack>
        </View>
      </VStack>
    </BaseSlide>
  );
}
