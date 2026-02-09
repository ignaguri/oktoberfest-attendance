import { Motion } from "@legendapp/motion";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import {
  formatCurrency,
  formatWrappedDate,
} from "@prostcounter/shared/wrapped";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { BaseSlide, SlideSubtitle, SlideTitle, StatItem } from "./base-slide";

interface PeakMomentSlideProps {
  data: WrappedData;
  isActive: boolean;
}

export function PeakMomentSlide({ data, isActive }: PeakMomentSlideProps) {
  const { t } = useTranslation();
  const confettiRef = useRef<ConfettiCannon>(null);

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        confettiRef.current?.start();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const bestDay = data.peak_moments.best_day;

  return (
    <BaseSlide isActive={isActive} backgroundClassName="bg-amber-50">
      <VStack space="lg" className="flex-1 justify-center">
        <SlideTitle isActive={isActive}>
          {t("wrapped.peakMoment.title")}
        </SlideTitle>
        <SlideSubtitle isActive={isActive}>
          {t("wrapped.peakMoment.subtitle")}
        </SlideSubtitle>

        {bestDay && (
          <Motion.View
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: isActive ? 1 : 0,
              opacity: isActive ? 1 : 0,
            }}
            transition={{
              type: "spring",
              damping: 12,
              stiffness: 100,
              delay: 200,
            }}
            className="items-center rounded-2xl bg-white/70 p-6"
          >
            <Text className="text-5xl">{"\u{1F3C6}"}</Text>
            <Text className="mt-2 text-sm text-gray-500">
              {t("wrapped.peakMoment.bestDay")}
            </Text>
            <Text className="mt-1 text-lg font-semibold text-gray-800">
              {formatWrappedDate(bestDay.date)}
            </Text>
            <Text className="mt-2 text-3xl font-bold text-yellow-600">
              {bestDay.beer_count}{" "}
              {t("wrapped.peakMoment.beers", { count: bestDay.beer_count })}
            </Text>
            <Text className="mt-1 text-sm text-gray-500">
              {formatCurrency(bestDay.spent)} {t("wrapped.peakMoment.spent")}
            </Text>
          </Motion.View>
        )}

        <View className="mt-2">
          <StatItem
            label={t("wrapped.peakMoment.maxSession")}
            value={String(data.peak_moments.max_single_session)}
            isActive={isActive}
            delay={500}
          />
        </View>
      </VStack>

      {/* Confetti */}
      <View className="absolute inset-0" pointerEvents="none">
        <ConfettiCannon
          ref={confettiRef}
          count={100}
          origin={{ x: -10, y: 0 }}
          fadeOut
          explosionSpeed={350}
          fallSpeed={3000}
          autoStart={false}
        />
      </View>
    </BaseSlide>
  );
}
