import { Motion } from "@legendapp/motion";
import { useTranslation } from "@prostcounter/shared/i18n";
import type { WrappedData } from "@prostcounter/shared/wrapped";
import * as Haptics from "expo-haptics";
import { Share2 } from "lucide-react-native";
import { useCallback, useRef } from "react";
import { Pressable, View } from "react-native";
import ViewShot from "react-native-view-shot";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useWrappedShare } from "@/hooks/useWrappedShare";
import { IconColors } from "@/lib/constants/colors";

import { ShareImage } from "../share-image";
import { BaseSlide, SlideSubtitle, SlideTitle } from "./base-slide";

interface OutroSlideProps {
  data: WrappedData;
  isActive: boolean;
  onClose: () => void;
}

export function OutroSlide({ data, isActive, onClose }: OutroSlideProps) {
  const { t } = useTranslation();
  const shareRef = useRef<ViewShot>(null);
  const { handleShare, isSharing } = useWrappedShare(data, shareRef);

  const onSharePress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await handleShare();
  }, [handleShare]);

  return (
    <BaseSlide isActive={isActive} backgroundClassName="bg-yellow-50">
      <VStack space="lg" className="flex-1 items-center justify-center">
        {/* Heart emoji */}
        <Motion.View
          initial={{ scale: 0 }}
          animate={{ scale: isActive ? 1 : 0 }}
          transition={{
            type: "spring",
            damping: 10,
            stiffness: 80,
            delay: 200,
          }}
          style={{ overflow: "visible" }}
        >
          <Text className="text-center text-5xl" style={{ lineHeight: 80 }}>
            {"\u{1F49B}"}
          </Text>
        </Motion.View>

        <SlideTitle isActive={isActive} delay={300}>
          {t("wrapped.outro.title")}
        </SlideTitle>
        <SlideSubtitle isActive={isActive} delay={400}>
          {t("wrapped.outro.subtitle")}
        </SlideSubtitle>

        {/* Summary stats */}
        <Motion.View
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 20 }}
          transition={{ type: "timing", duration: 500, delay: 500 }}
          className="items-center rounded-2xl bg-white/70 px-6 py-4"
        >
          <Text className="text-sm text-gray-500">
            {data.festival_info?.name ?? ""}
          </Text>
          <Text className="mt-1 text-lg font-bold text-gray-800">
            {data.basic_stats?.total_beers ?? 0}{" "}
            {t("wrapped.outro.summary.beers", {
              count: data.basic_stats?.total_beers ?? 0,
            })}{" "}
            {"\u{1F37A}"} {"\u{00B7}"} {data.tent_stats?.unique_tents ?? 0}{" "}
            {t("wrapped.outro.summary.tents", {
              count: data.tent_stats?.unique_tents ?? 0,
            })}{" "}
            {"\u{1F3AA}"} {"\u{00B7}"} {data.basic_stats?.days_attended ?? 0}{" "}
            {t("wrapped.outro.summary.days", {
              count: data.basic_stats?.days_attended ?? 0,
            })}
          </Text>
        </Motion.View>

        {/* Share button */}
        <Motion.View
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : 20 }}
          transition={{ type: "timing", duration: 500, delay: 700 }}
        >
          <Pressable
            onPress={onSharePress}
            disabled={isSharing}
            className="flex-row items-center gap-2 rounded-xl bg-yellow-500 px-8 py-4"
            accessibilityLabel={t("wrapped.outro.share")}
            accessibilityRole="button"
          >
            <Share2 size={20} color={IconColors.white} />
            <Text className="text-base font-semibold text-white">
              {isSharing
                ? t("wrapped.outro.sharing")
                : t("wrapped.outro.share")}
            </Text>
          </Pressable>
        </Motion.View>

        {/* Close button */}
        <Motion.View
          initial={{ opacity: 0 }}
          animate={{ opacity: isActive ? 1 : 0 }}
          transition={{ type: "timing", duration: 400, delay: 900 }}
        >
          <Pressable
            onPress={onClose}
            className="mt-2 px-4 py-2"
            accessibilityLabel={t("wrapped.close")}
            accessibilityRole="button"
          >
            <Text className="text-sm text-gray-500">{t("wrapped.close")}</Text>
          </Pressable>
        </Motion.View>
      </VStack>

      {/* Hidden share image for capture */}
      <View style={{ position: "absolute", left: -9999, top: 0 }}>
        <ViewShot ref={shareRef} options={{ format: "png", quality: 0.95 }}>
          <ShareImage data={data} />
        </ViewShot>
      </View>
    </BaseSlide>
  );
}
