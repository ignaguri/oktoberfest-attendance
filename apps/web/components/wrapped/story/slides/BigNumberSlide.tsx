"use client";

import { type StorySlideOf, useCountUp, useStoryCopy, useStoryNumber } from "@prostcounter/shared/wrapped";

import { Reveal } from "../Reveal";
import { StoryBig, StoryBody, StoryHeading, StoryKicker, StoryNote } from "../StoryText";

export function BigNumberSlide({ slide, animate }: { slide: StorySlideOf<"bigNumber">; animate: boolean }) {
  const copy = useStoryCopy();
  const formatNumber = useStoryNumber();
  const beers = useCountUp(slide.beers, animate);
  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <Reveal step={0} animate={animate}>
        <StoryKicker>{copy(slide.kicker)}</StoryKicker>
      </Reveal>
      <Reveal step={1} animate={animate}>
        <StoryBig>{formatNumber(beers)}</StoryBig>
        <StoryHeading className="text-2xl">{copy(slide.unit)}</StoryHeading>
      </Reveal>
      <Reveal step={2} animate={animate}>
        <StoryBody>{copy(slide.tagline)}</StoryBody>
      </Reveal>
      {slide.comparison ? (
        <Reveal step={3} animate={animate}>
          <StoryNote className="text-base">{copy(slide.comparison)}</StoryNote>
        </Reveal>
      ) : null}
    </div>
  );
}
