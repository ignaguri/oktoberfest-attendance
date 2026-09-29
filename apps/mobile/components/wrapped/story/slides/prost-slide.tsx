import { useTranslation } from "@prostcounter/shared/i18n";
import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";
import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import { Pressable, View } from "react-native";

import { HStack } from "@/components/ui/hstack";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

import { Crest } from "../crest";
import { Reveal } from "../reveal";
import { StoryBig, StoryHeading } from "../story-text";

interface ProstSlideProps {
  slide: StorySlideOf<"prost">;
  animate: boolean;
  onShare: () => void;
  onReplay: () => void;
  onClose: () => void;
}

export function ProstSlide({ slide, animate, onShare, onReplay, onClose }: ProstSlideProps) {
  const { t } = useTranslation();
  const copy = useStoryCopy();

  const onSharePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onShare();
  }, [onShare]);

  return (
    <VStack space="lg" className="flex-1 justify-center" pointerEvents="box-none">
      <Reveal step={0} animate={animate} kind="stamp">
        {/* Amber on the paper is too faint alone, so a navy copy sits behind it as a sticker shadow. */}
        <View>
          <Text
            className="absolute left-0 right-0 top-0 translate-x-1 translate-y-1 text-center font-wrapped text-8xl font-extrabold leading-none text-wrapped-ink"
            aria-hidden
            importantForAccessibility="no"
          >
            {copy(slide.title)}
          </Text>
          <StoryBig className="text-center text-8xl text-wrapped-amber">{copy(slide.title)}</StoryBig>
        </View>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <StoryHeading className="text-center text-2xl">{copy(slide.summary)}</StoryHeading>
      </Reveal>
      <Reveal step={2} animate={animate}>
        <HStack space="md" className="items-center rounded-2xl bg-wrapped-ink px-4 py-3">
          <Crest personaId={slide.recap.personaId} size="sm" />
          <VStack className="flex-1">
            <Text className="font-wrapped text-xl font-extrabold text-wrapped-paper">{slide.recap.name}</Text>
            <Text className="text-sm font-bold text-wrapped-amber">{slide.recap.facts.map(copy).join(" · ")}</Text>
          </VStack>
        </HStack>
      </Reveal>
      <VStack space="md" className="mt-4" pointerEvents="box-none">
        <Pressable
          onPress={onSharePress}
          className="items-center rounded-xl bg-wrapped-amber px-6 py-4"
          accessibilityRole="button"
          accessibilityLabel={t("wrapped.outro.share")}
          accessibilityHint={t("wrapped.outro.shareHint")}
        >
          <Text className="text-base font-bold text-wrapped-ink">{t("wrapped.outro.share")}</Text>
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
    </VStack>
  );
}
