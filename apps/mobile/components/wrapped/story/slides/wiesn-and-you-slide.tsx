import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBig, StoryBody, StoryHeading, StoryKicker, StoryNote } from "../story-text";

export function WiesnAndYouSlide({ slide, animate }: { slide: StorySlideOf<"wiesnAndYou">; animate: boolean }) {
  const copy = useStoryCopy();

  return (
    <VStack space="lg" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryKicker>{copy(slide.kicker)}</StoryKicker>
        <StoryBig className="mt-2">1</StoryBig>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <StoryHeading className="text-3xl">{copy(slide.headline)}</StoryHeading>
      </Reveal>
      {slide.share ? (
        <Reveal step={2} animate={animate}>
          <StoryBody>{copy(slide.share)}</StoryBody>
        </Reveal>
      ) : null}
      <StoryNote className="mt-auto">{copy(slide.source)}</StoryNote>
    </VStack>
  );
}
