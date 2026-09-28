"use client";

import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { Reveal } from "../Reveal";
import { StoryBig, StoryBody, StoryHeading, StoryKicker, StoryNote } from "../StoryText";

export function WiesnAndYouSlide({ slide, animate }: { slide: StorySlideOf<"wiesnAndYou">; animate: boolean }) {
  const copy = useStoryCopy();
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
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
    </div>
  );
}
