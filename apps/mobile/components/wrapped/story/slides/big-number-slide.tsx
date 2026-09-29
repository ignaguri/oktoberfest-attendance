import { type StorySlideOf, useCountUp, useStoryCopy, useStoryNumber } from "@prostcounter/shared/wrapped";

import { VStack } from "@/components/ui/vstack";

import { Reveal } from "../reveal";
import { StoryBig, StoryBody, StoryHeading, StoryKicker, StoryNote } from "../story-text";

export function BigNumberSlide({ slide, animate }: { slide: StorySlideOf<"bigNumber">; animate: boolean }) {
  const copy = useStoryCopy();
  const formatNumber = useStoryNumber();
  const beers = useCountUp(slide.beers, animate);

  return (
    <VStack space="lg" className="flex-1 justify-center">
      <Reveal step={0} animate={animate}>
        <StoryKicker className="text-center text-sm">{copy(slide.kicker)}</StoryKicker>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <StoryBig className="text-center text-9xl">{formatNumber(beers)}</StoryBig>
        <StoryHeading className="text-center text-4xl">{copy(slide.unit)}</StoryHeading>
      </Reveal>
      <Reveal step={2} animate={animate}>
        <StoryBody className="text-center text-2xl">{copy(slide.tagline)}</StoryBody>
      </Reveal>
      {slide.comparison ? (
        <Reveal step={3} animate={animate}>
          <StoryNote className="text-center text-lg">{copy(slide.comparison)}</StoryNote>
        </Reveal>
      ) : null}
    </VStack>
  );
}
