import { Motion } from "@legendapp/motion";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { cn } from "@prostcounter/ui";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { BaseSlide, SlideTitle } from "./base-slide";

interface ComparisonsSlideProps {
  data: WrappedData;
  isActive: boolean;
}

function DiffIndicator({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const isPositive = value > 0;
  const color = cn(
    isPositive
      ? "text-green-600"
      : value < 0
        ? "text-red-500"
        : "text-gray-500",
  );
  const sign = value > 0 ? "+" : "";

  return (
    <Text className={cn("text-2xl font-bold", color)}>
      {sign}
      {value}
      {suffix}
    </Text>
  );
}

export function ComparisonsSlide({ data, isActive }: ComparisonsSlideProps) {
  const { t } = useTranslation();

  return (
    <BaseSlide isActive={isActive} backgroundClassName={cn("bg-teal-50")}>
      <VStack space="lg" className="flex-1 justify-center">
        <SlideTitle isActive={isActive}>
          {t("wrapped.comparisons.title")}
        </SlideTitle>

        {/* vs Festival Average */}
        <VStack space="sm">
          <Motion.View
            initial={{ opacity: 0 }}
            animate={{ opacity: isActive ? 1 : 0 }}
            transition={{ type: "timing", duration: 300, delay: 200 }}
          >
            <Text className="text-center text-sm font-semibold text-gray-600">
              {t("wrapped.comparisons.vsFestivalAvg")}
            </Text>
          </Motion.View>

          <HStack space="md">
            <Motion.View
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 20 }}
              transition={{ type: "timing", duration: 400, delay: 300 }}
              className="flex-1 items-center rounded-2xl bg-white/70 p-4"
            >
              <Text className="text-sm text-gray-500">
                {t("wrapped.comparisons.beers")}
              </Text>
              <DiffIndicator
                value={data.comparisons.vs_festival_avg.beers_diff_pct}
                suffix="%"
              />
            </Motion.View>
            <Motion.View
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 20 }}
              transition={{ type: "timing", duration: 400, delay: 450 }}
              className="flex-1 items-center rounded-2xl bg-white/70 p-4"
            >
              <Text className="text-sm text-gray-500">
                {t("wrapped.comparisons.days")}
              </Text>
              <DiffIndicator
                value={data.comparisons.vs_festival_avg.days_diff_pct}
                suffix="%"
              />
            </Motion.View>
          </HStack>
        </VStack>

        {/* vs Last Year */}
        {data.comparisons.vs_last_year && (
          <VStack space="sm" className="mt-2">
            <Motion.View
              initial={{ opacity: 0 }}
              animate={{ opacity: isActive ? 1 : 0 }}
              transition={{ type: "timing", duration: 300, delay: 600 }}
            >
              <Text className="text-center text-sm font-semibold text-gray-600">
                {t("wrapped.comparisons.vsLastYear")}
              </Text>
              <Text className="text-center text-xs text-gray-400">
                {t("wrapped.comparisons.vs")}{" "}
                {data.comparisons.vs_last_year.prev_festival_name}
              </Text>
            </Motion.View>

            <HStack space="md">
              <Motion.View
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 20 }}
                transition={{ type: "timing", duration: 400, delay: 700 }}
                className="flex-1 items-center rounded-2xl bg-white/70 p-4"
              >
                <Text className="text-sm text-gray-500">
                  {t("wrapped.comparisons.beers")}
                </Text>
                <DiffIndicator
                  value={data.comparisons.vs_last_year.beers_diff}
                />
              </Motion.View>
              <Motion.View
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 20 }}
                transition={{ type: "timing", duration: 400, delay: 850 }}
                className="flex-1 items-center rounded-2xl bg-white/70 p-4"
              >
                <Text className="text-sm text-gray-500">
                  {t("wrapped.comparisons.days")}
                </Text>
                <DiffIndicator
                  value={data.comparisons.vs_last_year.days_diff}
                />
              </Motion.View>
            </HStack>
          </VStack>
        )}
      </VStack>
    </BaseSlide>
  );
}
