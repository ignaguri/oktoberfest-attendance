import { REVEAL_STEP_MS, type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { View } from "react-native";

import { VStack } from "@/components/ui/vstack";

import { Crest } from "../crest";
import { Reveal } from "../reveal";
import { StoryBody, StoryHeading, StoryKicker, StoryStamp } from "../story-text";

const CREST_STEP = 1;

export function PersonaSlide({ slide, animate }: { slide: StorySlideOf<"persona">; animate: boolean }) {
  const copy = useStoryCopy();

  useEffect(() => {
    if (!animate) {
      return;
    }
    // The stamp lands a little after its step starts
    const timerId = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }, CREST_STEP * REVEAL_STEP_MS + 250);
    return () => clearTimeout(timerId);
  }, [animate]);

  return (
    <VStack space="md" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryKicker className="text-center">{copy(slide.kicker)}</StoryKicker>
      </Reveal>
      <Reveal step={CREST_STEP} animate={animate} kind="stamp" className="items-center">
        <View className="-rotate-6">
          <Crest personaId={slide.personaId} />
        </View>
      </Reveal>
      <Reveal step={2} animate={animate}>
        <StoryHeading className="text-center">{slide.name}</StoryHeading>
        <StoryBody className="mt-1 text-center italic">{copy(slide.description)}</StoryBody>
      </Reveal>
      <Reveal step={3} animate={animate} kind="fade">
        <View className="rounded-xl border-2 border-dashed border-wrapped-ink/30 bg-white/70 p-4">
          <StoryBody className="text-base">{copy(slide.because)}</StoryBody>
        </View>
      </Reveal>
      {slide.runnerUp ? (
        <Reveal step={4} animate={animate} kind="stamp" className="items-center">
          <StoryStamp className="self-center">{copy(slide.runnerUp)}</StoryStamp>
        </Reveal>
      ) : null}
    </VStack>
  );
}
