import { Motion } from "@legendapp/motion";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { BaseSlide } from "./base-slide";

interface IntroSlideProps {
  data: WrappedData;
  isActive: boolean;
}

export function IntroSlide({ data, isActive }: IntroSlideProps) {
  const { t } = useTranslation();
  const confettiRef = useRef<ConfettiCannon>(null);

  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        confettiRef.current?.start();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const username = data.user_info?.username || data.user_info?.full_name || "";

  return (
    <BaseSlide isActive={isActive} backgroundClassName="bg-yellow-50">
      <VStack space="xl" className="flex-1 items-center justify-center">
        {/* Festival emoji */}
        <Motion.View
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: isActive ? 1 : 0,
            opacity: isActive ? 1 : 0,
          }}
          transition={{ type: "spring", damping: 12, stiffness: 100 }}
        >
          <Text className="text-center text-7xl">{"\u{1F37B}"}</Text>
        </Motion.View>

        {/* Title */}
        <Motion.View
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 30 }}
          transition={{ type: "timing", duration: 600, delay: 200 }}
        >
          <Text className="text-center text-4xl font-bold text-gray-800">
            {t("wrapped.intro.title")}
          </Text>
        </Motion.View>

        {/* Festival name */}
        <Motion.View
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 20 }}
          transition={{ type: "timing", duration: 500, delay: 400 }}
        >
          <Text className="text-center text-xl font-semibold text-yellow-600">
            {data.festival_info?.name ?? ""}
          </Text>
        </Motion.View>

        {/* Username subtitle */}
        <Motion.View
          initial={{ opacity: 0 }}
          animate={{ opacity: isActive ? 1 : 0 }}
          transition={{ type: "timing", duration: 400, delay: 600 }}
        >
          <Text className="text-center text-base text-gray-500">
            {t("wrapped.intro.subtitle", { username })}
          </Text>
        </Motion.View>

        {/* Swipe hint */}
        <Motion.View
          initial={{ opacity: 0 }}
          animate={{ opacity: isActive ? 0.6 : 0 }}
          transition={{ type: "timing", duration: 400, delay: 1000 }}
          className="absolute bottom-8"
        >
          <Text className="text-center text-sm text-gray-400">
            {t("wrapped.swipeToBegin")} {"\u{1F449}"}
          </Text>
        </Motion.View>
      </VStack>

      {/* Confetti */}
      <View className="absolute inset-0" pointerEvents="none">
        <ConfettiCannon
          ref={confettiRef}
          count={150}
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
