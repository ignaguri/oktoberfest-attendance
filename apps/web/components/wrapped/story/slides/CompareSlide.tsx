"use client";

import { type StorySlideOf, useStoryCopy } from "@prostcounter/shared/wrapped";

import { cn } from "@/lib/utils";

import { Reveal } from "../Reveal";
import { StoryBig, StoryBody, StoryHeading } from "../StoryText";

/** Cards lean alternately, like the photos on the people slide. */
const TILTS = ["-rotate-2", "rotate-2"];

export function CompareSlide({ slide, animate }: { slide: StorySlideOf<"compare">; animate: boolean }) {
  const copy = useStoryCopy();
  return (
    <div className="flex flex-1 flex-col justify-center gap-14 text-center">
      <Reveal step={0} animate={animate}>
        <StoryHeading className="text-4xl">{copy(slide.title)}</StoryHeading>
      </Reveal>
      {slide.rows.map((row, index) => (
        <Reveal key={row.caption.key} step={index + 1} animate={animate}>
          <div
            className={cn("mx-4 my-2 rounded-2xl border-2 border-wrapped-ink bg-white px-5 py-5", TILTS[index % TILTS.length])}
          >
            <StoryBig className="text-6xl">{copy(row.stat)}</StoryBig>
            <StoryBody className="mt-1 text-lg">{copy(row.caption)}</StoryBody>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
