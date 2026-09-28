import { useTranslation } from "@prostcounter/shared/i18n";
import { type StorySlideOf, useStoryCopy, type WrappedData } from "@prostcounter/shared/wrapped";
import * as Haptics from "expo-haptics";
import { useCallback, useRef } from "react";
import { Pressable, View } from "react-native";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ShareImage } from "@/components/wrapped/share-image";
import { useWrappedShare } from "@/hooks/useWrappedShare";

import { Reveal } from "../reveal";
import { StoryBig, StoryHeading } from "../story-text";

interface ProstSlideProps {
  slide: StorySlideOf<"prost">;
  animate: boolean;
  data: WrappedData;
  onReplay: () => void;
  onClose: () => void;
}

export function ProstSlide({ slide, animate, data, onReplay, onClose }: ProstSlideProps) {
  const { t } = useTranslation();
  const copy = useStoryCopy();
  const shareRef = useRef<ViewShotRef>(null);
  const { handleShare, isSharing } = useWrappedShare(data, shareRef);

  const onSharePress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await handleShare();
  }, [handleShare]);

  return (
    <VStack space="lg" className="flex-1 justify-center" pointerEvents="box-none">
      <Reveal step={0} animate={animate} kind="stamp">
        <StoryBig className="text-7xl">{copy(slide.title)}</StoryBig>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <StoryHeading className="text-2xl">{copy(slide.summary)}</StoryHeading>
      </Reveal>
      <VStack space="md" className="mt-8" pointerEvents="box-none">
        <Pressable
          onPress={onSharePress}
          disabled={isSharing}
          className="items-center rounded-xl bg-wrapped-ink px-6 py-4"
          accessibilityRole="button"
          accessibilityLabel={t("wrapped.outro.share")}
          accessibilityHint={t("wrapped.outro.shareHint")}
        >
          <Text className="text-base font-bold text-wrapped-paper">
            {isSharing ? t("wrapped.outro.sharing") : t("wrapped.outro.share")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onReplay}
          className="items-center rounded-xl border-2 border-wrapped-ink px-6 py-3"
          accessibilityRole="button"
          accessibilityLabel={t("wrapped.story.prost.replay")}
          accessibilityHint={t("wrapped.story.prost.replayHint")}
        >
          <Text className="text-base font-bold text-wrapped-ink">{t("wrapped.story.prost.replay")}</Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          className="items-center px-6 py-2"
          accessibilityRole="button"
          accessibilityLabel={t("wrapped.close")}
          accessibilityHint={t("wrapped.story.a11y.closeHint")}
        >
          <Text className="text-sm text-wrapped-ink/70">{t("wrapped.close")}</Text>
        </Pressable>
      </VStack>

      {/* Off-screen share image for capture, as the old outro slide did */}
      <View className="absolute -left-[9999px] top-0">
        <ViewShot ref={shareRef} options={{ format: "png", quality: 0.95 }}>
          <ShareImage data={data} />
        </ViewShot>
      </View>
    </VStack>
  );
}
