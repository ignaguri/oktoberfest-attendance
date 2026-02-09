import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { formatCurrency, formatNumber } from "@prostcounter/shared/wrapped";
import {
  Beer,
  CalendarDays,
  DollarSign,
  TrendingUp,
} from "lucide-react-native";
import { View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { VStack } from "@/components/ui/vstack";
import { Colors } from "@/lib/constants/colors";

import { BaseSlide, SlideSubtitle, SlideTitle, StatItem } from "./base-slide";

interface NumbersSlideProps {
  data: WrappedData;
  isActive: boolean;
}

export function NumbersSlide({ data, isActive }: NumbersSlideProps) {
  const { t } = useTranslation();

  return (
    <BaseSlide isActive={isActive} backgroundClassName="bg-blue-50">
      <VStack space="lg" className="flex-1 justify-center">
        <SlideTitle isActive={isActive}>
          {t("wrapped.numbers.title")}
        </SlideTitle>
        <SlideSubtitle isActive={isActive}>
          {t("wrapped.numbers.subtitle")}
        </SlideSubtitle>

        <View className="mt-6">
          <VStack space="md">
            <HStack space="md">
              <View className="flex-1">
                <StatItem
                  label={t("wrapped.numbers.totalBeers")}
                  value={formatNumber(data.basic_stats?.total_beers ?? 0)}
                  icon={<Beer size={24} color={Colors.primary[500]} />}
                  isActive={isActive}
                  delay={200}
                />
              </View>
              <View className="flex-1">
                <StatItem
                  label={t("wrapped.numbers.daysAttended")}
                  value={formatNumber(data.basic_stats?.days_attended ?? 0)}
                  icon={<CalendarDays size={24} color={Colors.primary[500]} />}
                  isActive={isActive}
                  delay={350}
                />
              </View>
            </HStack>
            <HStack space="md">
              <View className="flex-1">
                <StatItem
                  label={t("wrapped.numbers.avgPerDay")}
                  value={(data.basic_stats?.avg_beers ?? 0).toFixed(1)}
                  icon={<TrendingUp size={24} color={Colors.primary[500]} />}
                  isActive={isActive}
                  delay={500}
                />
              </View>
              <View className="flex-1">
                <StatItem
                  label={t("wrapped.numbers.totalSpent")}
                  value={formatCurrency(data.basic_stats?.total_spent ?? 0)}
                  icon={<DollarSign size={24} color={Colors.primary[500]} />}
                  isActive={isActive}
                  delay={650}
                />
              </View>
            </HStack>
          </VStack>
        </View>
      </VStack>
    </BaseSlide>
  );
}
