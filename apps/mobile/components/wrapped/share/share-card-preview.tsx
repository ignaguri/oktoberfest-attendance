import { useTranslation } from "@prostcounter/shared/i18n";
import { type ShareCard, useStoryCopy } from "@prostcounter/shared/wrapped";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { ShareCardState } from "@/hooks/useShareCards";

import { PaperBackground } from "../story/paper-background";

const LOADING_LINES = [
  "wrapped.shareCards.carousel.loading1",
  "wrapped.shareCards.carousel.loading2",
  "wrapped.shareCards.carousel.loading3",
] as const;
const LINE_MS = 1600;

function Placeholder({ card }: { card: ShareCard }) {
  const { t } = useTranslation();
  const copy = useStoryCopy();
  const reduceMotion = useReducedMotion();
  const [line, setLine] = useState(0);
  const shimmer = useSharedValue(0.15);

  useEffect(() => {
    const timer = setInterval(
      () => setLine((current) => (current + 1) % LOADING_LINES.length),
      LINE_MS,
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!reduceMotion) {
      shimmer.value = withRepeat(withTiming(0.5, { duration: 900 }), -1, true);
    }
  }, [reduceMotion, shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));

  return (
    <View className="flex-1 items-center justify-center px-4">
      <PaperBackground />
      <Animated.View
        className="absolute inset-0 bg-white"
        style={shimmerStyle}
        pointerEvents="none"
      />
      <Text className="text-center text-xs font-bold uppercase tracking-widest text-wrapped-ink/70">
        {copy(card.kicker)}
      </Text>
      <Text className="mt-3 text-center font-wrapped text-base font-extrabold text-wrapped-ink">
        {t(LOADING_LINES[line])}
      </Text>
    </View>
  );
}

interface ShareCardPreviewProps {
  card: ShareCard;
  state: ShareCardState | undefined;
  isOnline: boolean;
  label: string;
  onRetry: () => void;
}

export function ShareCardPreview({
  card,
  state,
  isOnline,
  label,
  onRetry,
}: ShareCardPreviewProps) {
  const { t } = useTranslation();
  return (
    <View
      className="aspect-[9/16] w-[60%] overflow-hidden rounded-2xl border-2 border-wrapped-ink bg-wrapped-paper"
      accessible
      accessibilityLabel={label}
    >
      {state?.status === "ready" ? (
        <Animated.Image
          entering={FadeIn.duration(300)}
          source={{ uri: state.uri }}
          className="h-full w-full"
        />
      ) : state?.status === "error" ? (
        <VStack space="md" className="flex-1 items-center justify-center px-4">
          <PaperBackground />
          <Text className="text-center font-wrapped text-base font-extrabold text-wrapped-ink">
            {isOnline
              ? t("wrapped.shareCards.carousel.error")
              : t("wrapped.shareCards.carousel.offline")}
          </Text>
          <Pressable
            onPress={onRetry}
            className="rounded-xl border-2 border-wrapped-ink px-4 py-2"
            accessibilityRole="button"
            accessibilityLabel={t("wrapped.shareCards.carousel.retry")}
          >
            <Text className="text-sm font-bold text-wrapped-ink">
              {t("wrapped.shareCards.carousel.retry")}
            </Text>
          </Pressable>
        </VStack>
      ) : (
        <Placeholder card={card} />
      )}
    </View>
  );
}
