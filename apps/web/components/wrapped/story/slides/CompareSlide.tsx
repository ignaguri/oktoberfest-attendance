"use client";

import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { Reveal } from "../Reveal";
import { StoryBody, StoryHeading } from "../StoryText";

export function CompareSlide({ slide, animate }: { slide: StorySlideOf<"compare">; animate: boolean }) {
  const copy = useStoryCopy();
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <Reveal step={0} animate={animate}>
        <StoryHeading>{copy(slide.title)}</StoryHeading>
      </Reveal>
      {slide.rows.map((row, index) => (
        <Reveal key={row.key} step={index + 1} animate={animate}>
          <div className="border-l-4 border-wrapped-amber pl-4">
            <StoryBody className="text-xl">{copy(row)}</StoryBody>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
