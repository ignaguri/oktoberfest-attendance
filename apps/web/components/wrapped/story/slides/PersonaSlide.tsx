"use client";

import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { Crest } from "../Crest";
import { Reveal } from "../Reveal";
import { StoryBody, StoryHeading, StoryKicker, StoryStamp } from "../StoryText";

export function PersonaSlide({ slide, animate }: { slide: StorySlideOf<"persona">; animate: boolean }) {
  const copy = useStoryCopy();
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <Reveal step={0} animate={animate}>
        <StoryKicker className="text-center text-sm">{copy(slide.kicker)}</StoryKicker>
      </Reveal>
      <Reveal step={1} animate={animate} kind="stamp" className="flex justify-center">
        <div className="-rotate-6">
          <Crest personaId={slide.personaId} />
        </div>
      </Reveal>
      <Reveal step={2} animate={animate}>
        <StoryHeading className="text-center text-5xl">{slide.name}</StoryHeading>
        <StoryBody className="mt-2 text-center text-xl italic">{copy(slide.description)}</StoryBody>
      </Reveal>
      <Reveal step={3} animate={animate} kind="fade">
        {/* A card like the compare ones, not a dashed box that reads as a form field. */}
        <div className="mx-4 rounded-2xl border-2 border-wrapped-ink bg-white px-5 py-4">
          <StoryBody className="text-center text-lg">{copy(slide.because)}</StoryBody>
        </div>
      </Reveal>
      {slide.runnerUp ? (
        <Reveal step={4} animate={animate} kind="stamp" className="flex justify-center">
          <StoryStamp className="self-center">{copy(slide.runnerUp)}</StoryStamp>
        </Reveal>
      ) : null}
    </div>
  );
}
